"use client"

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react"
import { motionValue, useTransform, type MotionValue } from "framer-motion"

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return reduced
}

export function useInView(ref: RefObject<Element | null>, rootMargin = "0px") {
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin])
  return inView
}

let webgl: boolean | undefined
function hasWebGL() {
  if (webgl === undefined) {
    try {
      const c = document.createElement("canvas")
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"))
    } catch {
      webgl = false
    }
  }
  return webgl
}

const noop = () => () => {}

/** Whether WebGL is available: null while prerendering (unknown), then true/false in the browser. */
export function useWebGL(): boolean | null {
  return useSyncExternalStore<boolean | null>(noop, hasWebGL, () => null)
}

/** Id of the section whose top has most recently crossed the upper third of the viewport. */
export function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: "-35% 0px -55% 0px" },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [ids])
  return active
}

/** Flips to true the first time the element enters the viewport, then stops observing. */
export function useSeenOnce(ref: RefObject<Element | null>, rootMargin = "0px") {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        setSeen(true)
        io.disconnect()
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin])
  return seen
}

const introSkipped = () => document.documentElement.dataset.intro === "skip"

/** True when the boot sequence already played this session (set before paint in layout.tsx). */
export function useIntroSkipped() {
  return useSyncExternalStore(noop, introSkipped, () => false)
}

// One scroll listener for the whole page. framer's useScroll() creates a tracker (and a
// measurement pass) per call; with several scroll-driven effects that adds up on phones.
const sharedScrollY = motionValue(0)
let scrollUsers = 0
const onScroll = () => sharedScrollY.set(window.scrollY)

/** The page's vertical scroll position as a single shared MotionValue. */
export function useSharedScrollY(): MotionValue<number> {
  useEffect(() => {
    if (scrollUsers++ === 0) {
      onScroll()
      window.addEventListener("scroll", onScroll, { passive: true })
    }
    return () => {
      if (--scrollUsers === 0) window.removeEventListener("scroll", onScroll)
    }
  }, [])
  return sharedScrollY
}

/** [element edge (0 = start, 1 = end), viewport line (0 = top, 1 = bottom)], like framer's "start 85%". */
type Edge = readonly [number, number]

/**
 * Scroll progress (0..1) of an element between two edge/viewport crossings. Same idea as
 * framer's `useScroll({ target, offset })`, but the element is measured only on resize,
 * not on every scroll frame, which is what keeps phones smooth.
 */
export function useElementProgress(ref: RefObject<Element | null>, [a, b]: readonly [Edge, Edge]): MotionValue<number> {
  const scrollY = useSharedScrollY()
  const box = useRef({ top: 0, height: 0, vh: 1 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      box.current = { top: r.top + window.scrollY, height: r.height, vh: window.innerHeight }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(document.body)
    window.addEventListener("resize", measure)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [ref])
  return useTransform(scrollY, (y) => {
    const { top, height, vh } = box.current
    const start = top + a[0] * height - a[1] * vh
    const end = top + b[0] * height - b[1] * vh
    if (end === start) return y >= end ? 1 : 0
    return Math.min(1, Math.max(0, (y - start) / (end - start)))
  })
}
