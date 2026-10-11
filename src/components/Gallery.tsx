"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, useInView, useTransform } from "framer-motion"
import { ArrowLeft, ArrowRight, X } from "@phosphor-icons/react"
import { WORKS, WORKS_ARE_SAMPLES } from "@/content/site"
import { paint } from "./paintings"
import { useElementProgress } from "./hooks"

type Work = (typeof WORKS)[number]
const noop = () => () => {}
const EASE = [0.16, 1, 0.3, 1] as const
const FRAME_REVEAL = {
  shut: { clipPath: "circle(0% at 50% 55%)" },
  open: { clipPath: "circle(110% at 50% 55%)" },
}

// One shared painter worker; canvases are handed over once (transferControlToOffscreen
// can only be called once per canvas, which matters under React's dev double-mount).
let painter: Worker | null = null
const handedOver = new WeakSet<HTMLCanvasElement>()
const getPainter = () => (painter ??= new Worker(new URL("./paint.worker.ts", import.meta.url)))

function drawPainting(canvas: HTMLCanvasElement, work: Work, seed: number) {
  if (handedOver.has(canvas)) return
  handedOver.add(canvas)
  if ("transferControlToOffscreen" in canvas && typeof Worker !== "undefined") {
    const off = canvas.transferControlToOffscreen()
    getPainter().postMessage(
      { canvas: off, w: canvas.width, h: canvas.height, style: work.style, palette: work.palette, seed },
      [off],
    )
    return
  }
  // Older browsers: paint on the main thread, but only when it is idle.
  const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1))
  idle(() => {
    const ctx = canvas.getContext("2d")
    if (ctx) paint(ctx, canvas.width, canvas.height, work.style, work.palette, seed)
  })
}

/** A painting: a real image when one is supplied, otherwise a sample painted off-thread as it nears the screen. */
function Painting({ work, seed, w, h, eager = false }: { work: Work; seed: number; w: number; h: number; eager?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || work.image) return
    if (eager) {
      drawPainting(canvas, work, seed)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        drawPainting(canvas, work, seed)
      },
      { rootMargin: "800px" },
    )
    io.observe(canvas)
    return () => io.disconnect()
  }, [work, seed, eager])
  if (work.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="painting" src={work.image} alt={`${work.title}, ${work.medium}, ${work.year}`} loading="lazy" />
  }
  return <canvas ref={ref} className="painting" width={w} height={h} role="img" aria-label={`${work.title}, ${work.medium}, ${work.year}`} />
}

function Viewer({
  index,
  origin,
  onClose,
  onStep,
}: {
  index: number
  origin: { x: number; y: number }
  onClose: () => void
  onStep: (d: 1 | -1) => void
}) {
  const work = WORKS[index]
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") onStep(1)
      if (e.key === "ArrowLeft") onStep(-1)
    }
    const lenis = (window as unknown as { __lenis?: { stop?: () => void; start?: () => void } }).__lenis
    lenis?.stop?.()
    document.documentElement.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.documentElement.style.overflow = ""
      lenis?.start?.()
    }
  }, [onClose, onStep])

  const at = `${origin.x}px ${origin.y}px`
  return (
    <motion.div
      className="viewer"
      role="dialog"
      aria-modal="true"
      aria-label={work.title}
      style={{ ["--flood" as string]: work.palette[0] }}
      initial={{ clipPath: `circle(0px at ${at})` }}
      animate={{ clipPath: `circle(150% at ${at})` }}
      exit={{ clipPath: `circle(0px at ${at})` }}
      transition={{ duration: 0.85, ease: EASE }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <AnimatePresence mode="wait">
        <motion.figure
          key={work.id}
          className="viewer-figure"
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
        >
          <div className="viewer-mat">
            <Painting work={work} seed={index * 7919 + 11} w={1200} h={1500} eager />
          </div>
          <figcaption>
            <span className="viewer-kind">{work.kind}</span>
            <span className="viewer-title">{work.title}</span>
            <span>
              {work.medium}, {work.year}
            </span>
            {work.desc && <span className="viewer-desc">{work.desc}</span>}
            {work.stack && (
              <span className="viewer-stack">
                {work.stack.map((t) => (
                  <code key={t}>{t}</code>
                ))}
              </span>
            )}
          </figcaption>
        </motion.figure>
      </AnimatePresence>
      <div className="viewer-controls">
        <button type="button" onClick={() => onStep(-1)} aria-label="Previous work">
          <ArrowLeft weight="bold" />
        </button>
        <span className="viewer-count">
          {index + 1} / {WORKS.length}
        </span>
        <button type="button" onClick={() => onStep(1)} aria-label="Next work">
          <ArrowRight weight="bold" />
        </button>
      </div>
      <button ref={closeRef} type="button" className="viewer-close" onClick={onClose}>
        <X weight="bold" aria-hidden="true" />
        <span>Close</span>
      </button>
    </motion.div>
  )
}

/**
 * The work as a salon wall. On wide screens the wall slides sideways while the page scrolls
 * down; on phones it is a swipeable row. Opening a piece floods the screen with its colour.
 */
export default function Gallery({ reduced }: { reduced: boolean }) {
  const pinRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [shift, setShift] = useState(0)
  const [open, setOpen] = useState<{ i: number; x: number; y: number } | null>(null)
  const progress = useElementProgress(pinRef, [
    [0, 0],
    [1, 1],
  ])
  // Frames open once, as soon as any of the wall is on screen. (The pinned wall is many screens
  // tall, so waiting for a share of it to be visible could leave the frames shut on short windows.)
  const wallIn = useInView(pinRef, { once: true })
  // Moving down the page walks the wall from the first piece: the cards travel right to left,
  // and back again on the way up.
  const x = useTransform(progress, (p) => -p * shift)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = () => setShift(Math.max(0, track.scrollWidth - window.innerWidth + 64))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    window.addEventListener("resize", measure)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [])

  // False during prerender, true in the browser: portals can't render on the server.
  const canPortal = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
  const step = (d: 1 | -1) => setOpen((o) => (o ? { ...o, i: (o.i + d + WORKS.length) % WORKS.length } : o))

  return (
    <>
      <div className="wall-pin" ref={pinRef} style={{ ["--shift" as string]: `${shift}px` }}>
        <div className="wall-sticky">
          {/* Driven by the visitor's own scrolling, so it stays on with reduced motion too. */}
          <motion.div className="wall-track" ref={trackRef} style={{ x }}>
            {WORKS.map((w, i) => (
              <motion.button
                key={w.id}
                type="button"
                className={`frame frame--${i % 3}`}
                onClick={(e) => setOpen({ i, x: e.clientX, y: e.clientY })}
                variants={FRAME_REVEAL}
                initial="shut"
                animate={reduced || wallIn ? "open" : "shut"}
                // With reduced motion the frames are simply there; no iris opening.
                transition={reduced ? { duration: 0 } : { duration: 1.4, ease: EASE, delay: i * 0.12 }}
                aria-label={`Open ${w.title}`}
              >
                <span className="frame-spec" aria-hidden="true">
                  Frame <b>{i % 3 === 1 ? "900 × 760" : "760 × 960"}</b>
                </span>
                <span className="mat">
                  <Painting work={w} seed={i * 7919 + 11} w={i % 3 === 1 ? 900 : 760} h={i % 3 === 1 ? 760 : 960} />
                </span>
                <span className="label">
                  <span className={`tag tag--${w.kind === "Engineering" ? "eng" : "art"}`}>{w.kind}</span>
                  <b>{w.title}</b>
                  <span>
                    {w.medium}, {w.year}
                  </span>
                </span>
              </motion.button>
            ))}
            {WORKS_ARE_SAMPLES && (
              <p className="wall-note">Sample projects and paintings, generated for this preview. The real work is coming soon.</p>
            )}
          </motion.div>
        </div>
      </div>
      {/* Portalled to <body> so it covers the fixed name pill and menu, not just the wall's layer. */}
      {canPortal &&
        createPortal(
          <AnimatePresence>
            {open && (
              <Viewer key="viewer" index={open.i} origin={{ x: open.x, y: open.y }} onClose={() => setOpen(null)} onStep={step} />
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
