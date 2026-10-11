"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import dynamic from "next/dynamic"
import { createPortal } from "react-dom"
import { AnimatePresence } from "framer-motion"
import { WORKS } from "@/content/site"
import { useIntroSkipped } from "./hooks"
import Book from "./Book"
import { buildPages, SPREADS } from "./Pages"
import { Viewer } from "./works"

const WetPaper = dynamic(() => import("./WetPaper"), { ssr: false })

// The open spread lives in the URL hash (#about, #work…), so a page can be linked to.
const SPREAD_EVENT = "jj-spread"
const onHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb)
  window.addEventListener(SPREAD_EVENT, cb)
  return () => {
    window.removeEventListener("hashchange", cb)
    window.removeEventListener(SPREAD_EVENT, cb)
  }
}
const hashSpread = () => Math.max(0, SPREADS.findIndex((s) => `#${s.id}` === window.location.hash))

// Wide screens show the book open as a two-page spread; narrow ones, one page at a time.
const WIDE = "(min-width: 900px) and (min-aspect-ratio: 5/4)"
const onWide = (cb: () => void) => {
  const mq = window.matchMedia(WIDE)
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}

/** True when the element under the pointer can still scroll that way (a long page). */
function scrollsFirst(target: EventTarget | null, dir: 1 | -1) {
  const el = (target as HTMLElement | null)?.closest?.<HTMLElement>("[data-scroll]")
  if (!el) return false
  return dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 2 : el.scrollTop > 2
}

const noop = () => () => {}

export default function Page() {
  const skipped = useIntroSkipped()
  const spread = useSyncExternalStore(onHash, hashSpread, () => 0)
  const wide = useSyncExternalStore(onWide, () => window.matchMedia(WIDE).matches, () => true)
  const canPortal = useSyncExternalStore(noop, () => true, () => false)
  const [bloomed, setBloomed] = useState(false)
  // On a single-page screen, which side of the current spread is showing.
  const [side, setSide] = useState<0 | 1>(0)
  const [selected, setSelected] = useState(0)
  const [open, setOpen] = useState<{ i: number; x: number; y: number } | null>(null)
  const lock = useRef(0)

  useEffect(() => {
    document.documentElement.dataset.boot = bloomed ? "done" : "hold"
    if (bloomed) return
    const bail = setTimeout(() => setBloomed(true), 5000)
    return () => clearTimeout(bail)
  }, [bloomed])

  const go = useCallback((s: number, toSide: 0 | 1 = 0) => {
    const next = Math.max(0, Math.min(SPREADS.length - 1, s))
    setSide(toSide)
    if (next !== hashSpread()) {
      history.replaceState(null, "", next === 0 ? window.location.pathname : `#${SPREADS[next].id}`)
      window.dispatchEvent(new Event(SPREAD_EVENT))
    }
    // Move focus to the new spread's title once the page has turned.
    setTimeout(() => document.getElementById(`${SPREADS[next].id}-h`)?.focus({ preventScroll: true }), 1000)
  }, [])

  const turn = useCallback(
    (d: 1 | -1) => {
      const s = hashSpread()
      if (wide) return go(s + d)
      // One page at a time: the right-hand page of a spread comes before the next spread.
      if (d > 0) {
        if (side === 0) setSide(1)
        else if (s < SPREADS.length - 1) go(s + 1, 0)
      } else if (side === 1) setSide(0)
      else if (s > 0) go(s - 1, 1)
    },
    [go, side, wide],
  )

  // Turn one page per wheel gesture, swipe or key press; long pages scroll first.
  useEffect(() => {
    let acc = 0
    let reset: ReturnType<typeof setTimeout>
    const flick = (d: 1 | -1) => {
      const now = performance.now()
      if (now < lock.current || document.querySelector(".viewer")) return
      lock.current = now + 1050
      turn(d)
    }
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      const dir = delta > 0 ? 1 : -1
      if (scrollsFirst(e.target, dir)) return
      acc += delta
      clearTimeout(reset)
      reset = setTimeout(() => (acc = 0), 180)
      if (Math.abs(acc) > 40) {
        flick(acc > 0 ? 1 : -1)
        acc = 0
      }
    }
    let sx = 0
    let sy = 0
    let startTarget: EventTarget | null = null
    const onStart = (e: TouchEvent) => {
      sx = e.touches[0].clientX
      sy = e.touches[0].clientY
      startTarget = e.target
    }
    const onEnd = (e: TouchEvent) => {
      const dx = sx - e.changedTouches[0].clientX
      const dy = sy - e.changedTouches[0].clientY
      // A sideways swipe turns the page like paper; an upward one does too.
      const horizontal = Math.abs(dx) > Math.abs(dy)
      const d = horizontal ? dx : dy
      if (Math.abs(d) < 50) return
      const dir = d > 0 ? 1 : -1
      if (!horizontal && scrollsFirst(startTarget, dir)) return
      flick(dir)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".viewer")) return
      if (["ArrowRight", "ArrowDown", "PageDown"].includes(e.key)) {
        e.preventDefault()
        flick(1)
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault()
        flick(-1)
      } else if (e.key === "Home") go(0)
      else if (e.key === "End") go(SPREADS.length - 1)
    }
    window.addEventListener("wheel", onWheel, { passive: true })
    window.addEventListener("touchstart", onStart, { passive: true })
    window.addEventListener("touchend", onEnd, { passive: true })
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("touchstart", onStart)
      window.removeEventListener("touchend", onEnd)
      window.removeEventListener("keydown", onKey)
      clearTimeout(reset)
    }
  }, [go, turn])

  const pages = useMemo(
    () =>
      buildPages({
        revealed: bloomed,
        selected,
        onSelect: setSelected,
        onOpenWork: (i, x, y) => setOpen({ i, x, y }),
        onGo: (s) => go(s),
      }),
    [bloomed, selected, go],
  )
  const at = wide ? spread * 2 : spread * 2 + side
  const first = at === 0
  const last = wide ? spread === SPREADS.length - 1 : at === pages.length - 1
  const step = (d: 1 | -1) => setOpen((o) => (o ? { ...o, i: (o.i + d + WORKS.length) % WORKS.length } : o))

  return (
    <div className="desk">
      {/* Rough, dragged edges for brushed swatches and paint dots. */}
      <svg className="defs" width="0" height="0" aria-hidden="true" focusable="false">
        <filter id="brush" x="-5%" y="-30%" width="110%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.35" numOctaves="3" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <WetPaper reduced={false} boot={!skipped} onBloom={() => setBloomed(true)} />
      <main className="desk-center">
        <Book pages={pages} at={at} spread={wide}>
          <nav className="tabs" aria-label="Sections">
            {SPREADS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className="tab"
                style={{ ["--pig" as string]: s.pigment, ["--i" as string]: i }}
                aria-current={i === spread ? "page" : undefined}
                onClick={() => go(i)}
              >
                <span>{s.label}</span>
              </button>
            ))}
          </nav>
          {!first && (
            <button type="button" className="corner corner--back" onClick={() => turn(-1)} aria-label="Previous page">
              <span aria-hidden="true">←</span>
            </button>
          )}
          {!last && (
            <button type="button" className="corner corner--next" onClick={() => turn(1)} aria-label="Next page">
              <span aria-hidden="true">→</span>
            </button>
          )}
        </Book>
        <p className="book-status" aria-live="polite">
          <span>
            {wide ? `pages ${at + 1}–${at + 2}` : `page ${at + 1}`} of {pages.length}
          </span>
          <span className="bs-hint" aria-hidden="true">
            <kbd>←</kbd>
            <kbd>→</kbd> or scroll to turn
          </span>
        </p>
      </main>
      {canPortal &&
        createPortal(
          <AnimatePresence>
            {open && <Viewer key="viewer" index={open.i} origin={{ x: open.x, y: open.y }} onClose={() => setOpen(null)} onStep={step} />}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  )
}
