"use client"

import { useEffect, useRef, useState } from "react"
import { createFluid, PIGMENTS, type Fluid, type Pigment, type PigmentName } from "./fluid"
import { brushState } from "./brushState"

const STROKE_ORDER: PigmentName[] = ["madder", "ultramarine", "ochre", "viridian", "rose"]
const AMBIENT: PigmentName[] = ["ultramarine", "madder", "ochre", "viridian", "rose"]

type Stroke = { pts: [number, number][]; pigment: Pigment; t0: number; dur: number; amount: number }

/** A curved brush path across part of the paper (uv coordinates, y up). */
function brushPath(rnd: () => number, region: [number, number, number, number]): [number, number][] {
  const [x0, x1, y0, y1] = region
  const a: [number, number] = [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)]
  const b: [number, number] = [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)]
  const c: [number, number] = [(a[0] + b[0]) / 2 + (rnd() - 0.5) * 0.4, (a[1] + b[1]) / 2 + (rnd() - 0.5) * 0.4]
  const pts: [number, number][] = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    const u = 1 - t
    pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]])
  }
  return pts
}

/**
 * The wet paper behind the hero and contact sections: a watercolour simulation the visitor
 * paints into. It keeps running while the middle sections cover it, and pauses only while
 * the tab is hidden.
 */
export default function WetPaper({
  reduced,
  boot,
  onBloom,
}: {
  reduced: boolean
  /** Play the opening drop (first visit of the session). */
  boot: boolean
  /** Fires once the opening drop has bloomed, so the name can ink in. */
  onBloom?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fluidRef = useRef<Fluid | null>(null)
  const strokes = useRef<Stroke[]>([])
  const [mode, setMode] = useState<"pending" | "live" | "fallback">("pending")
  const onBloomRef = useRef(onBloom)
  useEffect(() => {
    onBloomRef.current = onBloom
  }, [onBloom])

  // Create the simulation once.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const phone = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches
    const fluid = createFluid(canvas, phone ? "low" : "high")
    if (!fluid) {
      setMode("fallback")
      onBloomRef.current?.()
      return
    }
    fluidRef.current = fluid
    setMode("live")
    const ro = new ResizeObserver(() => fluid.resize())
    ro.observe(canvas)
    return () => {
      ro.disconnect()
      fluid.destroy()
      fluidRef.current = null
    }
  }, [])

  // Opening: a drop of ink lands and blooms, then two strokes of colour sweep out.
  useEffect(() => {
    const fluid = fluidRef.current
    if (mode !== "live" || !fluid) return
    const now = performance.now()
    const drop = () => {
      fluid.splat(0.5, 0.52, 0, 0, PIGMENTS.ink, 0.9, 0.0035)
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        fluid.splat(0.5 + Math.cos(a) * 0.01, 0.52 + Math.sin(a) * 0.01, Math.cos(a) * 900, Math.sin(a) * 900, null, 0, 0.0012)
      }
    }
    const rnd = Math.random
    if (reduced) {
      // A still painting: lay the strokes down and let them settle off-screen.
      drop()
      for (const name of ["madder", "ultramarine", "ochre"] as PigmentName[]) {
        const pts = brushPath(rnd, [0.45, 1, 0.1, 0.9])
        pts.forEach(([x, y], i) => {
          const [px, py] = pts[Math.max(0, i - 1)]
          fluid.splat(x, y, (x - px) * 4000, (y - py) * 4000, PIGMENTS[name], 0.08, 0.0018)
        })
      }
      for (let i = 0; i < 90; i++) fluid.step(1 / 60)
      fluid.render()
      onBloomRef.current?.()
      return
    }
    if (boot) {
      setTimeout(drop, 350)
      strokes.current.push(
        { pts: brushPath(rnd, [0.52, 0.95, 0.15, 0.85]), pigment: PIGMENTS.madder, t0: now + 1100, dur: 1100, amount: 0.07 },
        { pts: brushPath(rnd, [0.55, 1.0, 0.1, 0.7]), pigment: PIGMENTS.ultramarine, t0: now + 1500, dur: 1200, amount: 0.07 },
      )
      const t = setTimeout(() => onBloomRef.current?.(), 1500)
      return () => clearTimeout(t)
    }
    strokes.current.push(
      { pts: brushPath(rnd, [0.55, 0.95, 0.15, 0.85]), pigment: PIGMENTS.madder, t0: now + 150, dur: 1000, amount: 0.07 },
      { pts: brushPath(rnd, [0.55, 1.0, 0.1, 0.8]), pigment: PIGMENTS.ultramarine, t0: now + 450, dur: 1100, amount: 0.07 },
    )
    onBloomRef.current?.()
  }, [mode, boot, reduced])

  // The render loop, the visitor's brush, and ambient strokes when nobody is painting.
  useEffect(() => {
    const fluid = fluidRef.current
    // The brush works even with reduced motion: paint that follows the visitor's own hand
    // is a response to them, not motion they didn't ask for. Only ambient strokes stop.
    if (mode !== "live" || !fluid) return
    let raf = 0
    let last = performance.now()
    let lastInput = 0
    let nextAmbient = last + 4000
    let pigmentIx = 0
    let prev: { x: number; y: number; t: number } | null = null

    const brush = (cx: number, cy: number) => {
      const t = performance.now()
      const x = cx / window.innerWidth
      const y = 1 - cy / window.innerHeight
      brushState.x = x
      brushState.y = 1 - y
      // A pause starts a new stroke in the next colour.
      if (!prev || t - prev.t > 650) {
        pigmentIx = (pigmentIx + 1) % STROKE_ORDER.length
        brushState.pigment = STROKE_ORDER[pigmentIx]
        prev = { x, y, t }
        return
      }
      const dx = x - prev.x
      const dy = y - prev.y
      const dist = Math.hypot(dx, dy)
      if (dist < 0.0015) return
      const speed = Math.min(1, dist * 40)
      fluid.splat(x, y, dx * 4200, dy * 4200, PIGMENTS[STROKE_ORDER[pigmentIx]], 0.03 + speed * 0.04, 0.00035 + speed * 0.0006)
      prev = { x, y, t }
      lastInput = t
    }
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "mouse") brush(e.clientX, e.clientY)
    }
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) brush(t.clientX, t.clientY)
    }
    window.addEventListener("pointermove", onPointer, { passive: true })
    window.addEventListener("touchmove", onTouch, { passive: true })

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const raw = (now - last) / 1000
      const dt = Math.min(raw, 1 / 30)
      last = now
      if (raw > 0) brushState.fps += (1 / raw - brushState.fps) * 0.05
      brushState.live = !document.hidden
      if (document.hidden) return

      if (!reduced && now > nextAmbient && now - lastInput > 3000) {
        const name = AMBIENT[Math.floor(Math.random() * AMBIENT.length)]
        const region: [number, number, number, number] =
          window.innerWidth < 760 ? [0.05, 0.95, 0.05, 0.4] : [0.5, 1.0, 0.05, 0.95]
        strokes.current.push({ pts: brushPath(Math.random, region), pigment: PIGMENTS[name], t0: now, dur: 1400, amount: 0.05 })
        nextAmbient = now + 4500 + Math.random() * 3000
      }
      // Advance scripted strokes along their paths.
      strokes.current = strokes.current.filter((s) => {
        if (now < s.t0) return true
        const k = Math.min(1, (now - s.t0) / s.dur)
        const n = s.pts.length - 1
        const i = Math.min(n, Math.floor(k * n))
        const [x, y] = s.pts[i]
        const [px, py] = s.pts[Math.max(0, i - 1)]
        fluid.splat(x, y, (x - px) * 2200, (y - py) * 2200, s.pigment, s.amount, 0.0005 + 0.0006 * Math.sin(k * Math.PI))
        return k < 1
      })
      fluid.step(dt)
      fluid.render()
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("pointermove", onPointer)
      window.removeEventListener("touchmove", onTouch)
    }
  }, [mode, reduced])

  return (
    <div className="wet-paper" data-mode={mode} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
