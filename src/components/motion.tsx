"use client"

import { Fragment, useRef, type ReactNode, type PointerEvent } from "react"
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion"
import { useElementProgress } from "./hooks"

const EASE = [0.16, 1, 0.3, 1] as const

/** Headline whose words bleed in like ink the first time it scrolls into view. */
export function RevealHeading({
  as = "h2",
  id,
  text,
  reduced,
  className,
  via,
}: {
  as?: "h1" | "h2"
  id?: string
  text: string
  reduced: boolean
  className?: string
  via?: boolean
}) {
  const Tag = as === "h1" ? motion.h1 : motion.h2
  const words = text.split(" ")
  return (
    <Tag
      id={id}
      className={className}
      data-via={via ? "" : undefined}
      initial={reduced ? false : "hidden"}
      whileInView="shown"
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      aria-label={text}
    >
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="ink-word-wrap" aria-hidden="true">
            <motion.span
              className="ink-word"
              // Ink bleeding into paper: soft and condensed, then sharp and full width.
              // Opacity and transform only: animating a font axis or a filter forces the text to be
              // re-shaped or repainted every frame. scaleX reads as the letters widening as they ink in.
              variants={{
                hidden: { opacity: 0, scaleX: 0.82, y: "0.18em" },
                shown: { opacity: 1, scaleX: 1, y: "0em" },
              }}
              transition={{ duration: 1.3, ease: EASE, delay: i * 0.09 }}
            >
              {w}
            </motion.span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </Tag>
  )
}

/** Block that fades up once, staggered by index. */
export function Rise({
  children,
  reduced,
  i = 0,
  className,
}: {
  children: ReactNode
  reduced: boolean
  i?: number
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.8, ease: EASE, delay: i * 0.08 }}
    >
      {children}
    </motion.div>
  )
}

function Word({ p, from, to, children }: { p: MotionValue<number>; from: number; to: number; children: string }) {
  // Each word flips once as the scroll passes it and CSS eases the change, instead of
  // repainting the paragraph on every scroll frame.
  const opacity = useTransform(p, (v) => (v >= (from + to) / 2 ? 1 : 0.18))
  return (
    <motion.span className="lit-word" style={{ opacity }}>
      {children}{" "}
    </motion.span>
  )
}

/** A paragraph that lights up word by word as it passes through the viewport. */
export function ScrollLitText({ text, reduced, className }: { text: string; reduced: boolean; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const scrollYProgress = useElementProgress(ref, [[0, 0.85], [1, 0.45]])
  const words = text.split(" ")
  if (reduced) return <p className={className}>{text}</p>
  return (
    <p ref={ref} className={className} aria-label={text}>
      <span aria-hidden="true">
        {words.map((w, i) => (
          <Word key={i} p={scrollYProgress} from={i / words.length} to={(i + 1.5) / words.length}>
            {w}
          </Word>
        ))}
      </span>
    </p>
  )
}

/** Pulls its child a little toward the pointer, then springs back. */
export function Magnetic({ children, reduced }: { children: ReactNode; reduced: boolean }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.6 })
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.6 })
  const onMove = (e: PointerEvent<HTMLSpanElement>) => {
    if (reduced || e.pointerType !== "mouse") return
    const r = e.currentTarget.getBoundingClientRect()
    x.set((e.clientX - r.left - r.width / 2) * 0.22)
    y.set((e.clientY - r.top - r.height / 2) * 0.32)
  }
  const reset = () => {
    x.set(0)
    y.set(0)
  }
  return (
    <motion.span className="magnetic" style={{ x: sx, y: sy }} onPointerMove={onMove} onPointerLeave={reset}>
      {children}
    </motion.span>
  )
}
