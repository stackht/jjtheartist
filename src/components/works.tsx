"use client"

// The pieces: paintings drawn off-thread, and the full-screen viewer that floods with a
// work's colour.

import { useEffect, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, ArrowRight, X } from "@phosphor-icons/react"
import { WORKS } from "@/content/site"
import { paint } from "./paintings"

type Work = (typeof WORKS)[number]
const EASE = [0.16, 1, 0.3, 1] as const

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
export function Painting({ work, seed, w, h, eager = false }: { work: Work; seed: number; w: number; h: number; eager?: boolean }) {
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

export function Viewer({
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
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
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
