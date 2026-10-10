"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ARTIST, NAV } from "@/content/site"
import { useActiveSection, useReducedMotion } from "./hooks"

const IDS = NAV.map((n) => n.id)
const EASE = [0.16, 1, 0.3, 1] as const
const PIGMENT_HEX: Record<string, string> = {
  madder: "#c8342b",
  ultramarine: "#2d3bd1",
  ochre: "#e0a526",
  viridian: "#1f7a63",
  ink: "#1b1c22",
}

/**
 * Navigation as a blob of paint. Closed, it is a single glossy drop in the corner; open,
 * it fans out to the left into labelled colour swatches, one per section.
 */
export default function SwatchNav({ onJump }: { onJump: (id: string) => void }) {
  const active = useActiveSection(IDS)
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const blobRef = useRef<HTMLButtonElement>(null)

  const close = useCallback((restore = true) => {
    setOpen(false)
    if (restore) blobRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close()
    const onDown = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && close(false)
    window.addEventListener("keydown", onKey)
    window.addEventListener("pointerdown", onDown)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("pointerdown", onDown)
    }
  }, [open, close])

  return (
    <>
      <a
        className="brand"
        href="#top"
        onClick={(e) => {
          e.preventDefault()
          onJump("top")
        }}
      >
        {ARTIST.name}
      </a>
      <div className="swatch-dock" ref={rootRef} data-open={open}>
        <AnimatePresence>
          {open && (
            <motion.nav id="swatch-menu" className="swatches" aria-label="Sections">
              <ul>
                {NAV.map((n, i) => (
                  <motion.li
                    key={n.id}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, x: 40, rotate: 8, scale: 0.6 }}
                    animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, x: 30, scale: 0.7 }}
                    // The swatch nearest the blob lands first, like paint flicked from a brush.
                    transition={{ duration: 0.55, ease: EASE, delay: (NAV.length - 1 - i) * 0.045 }}
                  >
                    <a
                      href={`#${n.id}`}
                      style={{ ["--pig" as string]: PIGMENT_HEX[n.pigment] }}
                      aria-current={active === n.id ? "location" : undefined}
                      onClick={(e) => {
                        e.preventDefault()
                        close(false)
                        onJump(n.id)
                      }}
                    >
                      <i aria-hidden="true" />
                      {n.label}
                    </a>
                  </motion.li>
                ))}
              </ul>
            </motion.nav>
          )}
        </AnimatePresence>
        <button
          ref={blobRef}
          type="button"
          className="blob"
          data-open={open}
          aria-expanded={open}
          aria-controls="swatch-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="blob-paint" aria-hidden="true" />
          <span className="blob-x" aria-hidden="true">
            <i />
            <i />
          </span>
        </button>
      </div>
    </>
  )
}
