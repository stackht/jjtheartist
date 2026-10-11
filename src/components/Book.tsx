"use client"

import { useEffect, useState, type ReactNode } from "react"
import { animate, motion, useMotionValue, useTransform } from "framer-motion"

type Flip = { from: number; to: number }

/**
 * An open sketchbook. In spread mode it shows two pages side by side (index `at` is the left
 * page, always even); in single mode, one page. Changing `at` turns a real leaf: a two-sided
 * sheet rotating about the spine, carrying the old page on its front and the new one on its
 * back, with shading that follows the turn.
 */
export default function Book({
  pages,
  at,
  spread,
  children,
}: {
  pages: ReactNode[]
  at: number
  spread: boolean
  /** Extra furniture drawn on the book: tabs, corners. */
  children?: ReactNode
}) {
  // Start a turn whenever the target page changes (state adjusted during render, so the very
  // first frame of the new target already shows the turn).
  const [shown, setShown] = useState(at)
  const [flip, setFlip] = useState<Flip | null>(null)
  if (at !== shown && (!flip || flip.to !== at)) {
    setFlip({ from: flip ? flip.to : shown, to: at })
  }

  const rot = useMotionValue(0)
  const forward = flip ? flip.to > flip.from : true
  // Light falls across the turning sheet: darkest when it stands upright at the spine.
  const shade = useTransform(rot, (r) => Math.sin((Math.abs(r) * Math.PI) / 180) * 0.32)
  const castShadow = useTransform(rot, (r) => 0.28 * Math.sin((Math.abs(r) * Math.PI) / 180))

  useEffect(() => {
    if (!flip) return
    const fwd = flip.to > flip.from
    // Single-page backward turns bring the page in from the left; everything else turns away.
    const fromAngle = !spread && !fwd ? -180 : 0
    const toAngle = spread ? (fwd ? -180 : 180) : fwd ? -180 : 0
    rot.set(fromAngle)
    const controls = animate(rot, toAngle, {
      duration: 0.95,
      ease: [0.45, 0.05, 0.2, 1],
      onComplete: () => {
        setShown(flip.to)
        setFlip(null)
        rot.set(0)
      },
    })
    return () => controls.stop()
  }, [flip, spread, rot])

  const page = (i: number) => pages[i] ?? <div className="sheet sheet--blank" />
  let base: ReactNode
  let leaf: ReactNode = null

  if (spread) {
    const s = flip ? flip.from : shown
    if (!flip) {
      base = (
        <>
          <div className="page page--left">{page(s)}</div>
          <div className="page page--right">{page(s + 1)}</div>
        </>
      )
    } else {
      const t = flip.to
      base = (
        <>
          <div className="page page--left">{forward ? page(s) : page(t)}</div>
          <div className="page page--right">{forward ? page(t + 1) : page(s + 1)}</div>
        </>
      )
      leaf = (
        <motion.div className={`leaf leaf--${forward ? "right" : "left"}`} style={{ rotateY: rot }} aria-hidden="true">
          <div className="face face--front">
            {forward ? page(s + 1) : page(s)}
            <motion.i className="face-shade" style={{ opacity: shade }} />
          </div>
          <div className="face face--back">
            {forward ? page(t) : page(t + 1)}
            <motion.i className="face-shade" style={{ opacity: shade }} />
          </div>
        </motion.div>
      )
    }
  } else {
    const p = flip ? flip.from : shown
    if (!flip) {
      base = <div className="page page--single">{page(p)}</div>
    } else {
      base = <div className="page page--single">{forward ? page(flip.to) : page(p)}</div>
      leaf = (
        <motion.div className="leaf leaf--single" style={{ rotateY: rot }} aria-hidden="true">
          <div className="face face--front">
            {forward ? page(p) : page(flip.to)}
            <motion.i className="face-shade" style={{ opacity: shade }} />
          </div>
          <div className="face face--back">
            <div className="sheet sheet--blank" />
          </div>
        </motion.div>
      )
    }
  }

  return (
    <div className={`book ${spread ? "book--spread" : "book--single"}`} data-turning={flip ? "" : undefined}>
      <div className="book-block">
        {base}
        {spread && <i className="spine" aria-hidden="true" />}
        {leaf && <motion.i className="cast-shadow" style={{ opacity: castShadow }} aria-hidden="true" />}
        {leaf}
      </div>
      {children}
    </div>
  )
}
