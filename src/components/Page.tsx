"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Lenis from "lenis"
import { motion, useTransform } from "framer-motion"
import { ArrowUpRight, Check, Copy, EnvelopeSimple, GithubLogo, InstagramLogo, LinkedinLogo } from "@phosphor-icons/react"
import { ABOUT, ARTIST, LINKS, PATH, PATH_IS_PLACEHOLDER, TOOLS } from "@/content/site"
import { brushState, PIGMENT_HEX } from "./brushState"
import { useElementProgress, useIntroSkipped, useReducedMotion } from "./hooks"
import { Magnetic, RevealHeading, Rise, ScrollLitText } from "./motion"
import SwatchNav from "./SwatchNav"
import Gallery from "./Gallery"

const WetPaper = dynamic(() => import("./WetPaper"), { ssr: false })
const EASE = [0.16, 1, 0.3, 1] as const

/** The name inks onto the paper letter by letter: blurred and condensed, then sharp. */
function InkName({ revealed, reduced }: { revealed: boolean; reduced: boolean }) {
  let n = 0
  return (
    <h1 id="hero-name" className="hero-name" aria-label={ARTIST.name}>
      {[ARTIST.first, ARTIST.last].map((word, w) => (
        <span key={word} className={`name-line name-line--${w}`} aria-hidden="true">
          {[...word].map((ch, i) => {
            const k = n++
            return (
              <motion.span
                key={i}
                className="ink-letter"
                // Opacity and transform only, so the opening never re-lays-out the name per frame.
                initial={{ opacity: 0, scaleX: 0.7, y: "0.12em" }}
                animate={revealed ? { opacity: 1, scaleX: 1, y: "0em" } : { opacity: 0, scaleX: 0.7, y: "0.12em" }}
                transition={reduced ? { duration: 0 } : { duration: 1.4, ease: EASE, delay: 0.05 * k }}
              >
                {ch}
              </motion.span>
            )
          })}
        </span>
      ))}
    </h1>
  )
}

/** An engineer's readout of the brush: position, pigment and frame rate, like a dev console. */
function BrushReadout() {
  const pos = useRef<HTMLSpanElement>(null)
  const pig = useRef<HTMLSpanElement>(null)
  const chip = useRef<HTMLElement>(null)
  const fps = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    // Written straight to the DOM a few times a second; no React renders per frame.
    const id = setInterval(() => {
      if (pos.current) pos.current.textContent = `${brushState.x.toFixed(2)}, ${brushState.y.toFixed(2)}`
      if (pig.current) pig.current.textContent = `${brushState.pigment} ${PIGMENT_HEX[brushState.pigment] ?? ""}`
      if (chip.current) chip.current.style.background = PIGMENT_HEX[brushState.pigment] ?? "#000"
      if (fps.current) fps.current.textContent = brushState.live ? `${Math.round(brushState.fps)} fps` : "paused"
    }, 120)
    return () => clearInterval(id)
  }, [])
  return (
    <p className="readout" aria-hidden="true">
      <span className="ro-key">brush</span>
      <span ref={pos}>0.00, 0.00</span>
      <i ref={chip} className="ro-chip" />
      <span ref={pig}>madder #c8342b</span>
      <span ref={fps} className="ro-fps">· fps</span>
    </p>
  )
}

function Hero({ revealed, reduced, onJump }: { revealed: boolean; reduced: boolean; onJump: (id: string) => void }) {
  const rise = (i: number) => ({
    initial: { opacity: 0, y: 22 },
    animate: revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 },
    transition: reduced ? { duration: 0 } : { duration: 1.1, ease: EASE, delay: 0.9 + i * 0.1 },
  })
  return (
    <section id="top" className="hero" aria-labelledby="hero-name">
      <InkName revealed={revealed} reduced={reduced} />
      <div className="hero-foot">
        <motion.div className="hero-copy" {...rise(0)}>
          <p className="hero-role">{ARTIST.role}</p>
          <p className="hero-line">{ARTIST.line}</p>
        </motion.div>
        <motion.div className="hero-actions" {...rise(1)}>
          <Magnetic reduced={reduced}>
            <a
              className="btn btn--ink"
              href="#work"
              onClick={(e) => {
                e.preventDefault()
                onJump("work")
              }}
            >
              See the work
            </a>
          </Magnetic>
          <Magnetic reduced={reduced}>
            <a
              className="btn btn--paper"
              href="#contact"
              onClick={(e) => {
                e.preventDefault()
                onJump("contact")
              }}
            >
              Say hello
            </a>
          </Magnetic>
        </motion.div>
        <motion.div className="hero-side" {...rise(2)}>
          <BrushReadout />
        </motion.div>
      </div>
    </section>
  )
}

// A line break plus two-space indent inside the code card.
const NL = "\n  "

/** Her facts, written the way she'd write them at work: a small, syntax-coloured object. */
function CodeCard() {
  const k = (s: string) => <span className="tk-key">{s}</span>
  const str = (s: string) => <span className="tk-str">&quot;{s}&quot;</span>
  const list = (xs: readonly string[]) => (
    <>
      [
      {xs.map((x, i) => (
        <span key={x}>
          {str(x)}
          {i < xs.length - 1 ? ", " : ""}
        </span>
      ))}
      ]
    </>
  )
  return (
    <figure className="code-card">
      <figcaption>
        <i />
        <i />
        <i />
        <span>janhavi.ts</span>
      </figcaption>
      <pre>
        <code>
          <span className="tk-kw">const</span> <span className="tk-var">janhavi</span> = {"{"}
          {NL}
          {k("role")}: {str(ABOUT.code.role)},{NL}
          {k("stack")}: {list(ABOUT.code.stack)},{NL}
          {k("paints")}: {list(ABOUT.code.paints)},{NL}
          {k("openTo")}: {list(ABOUT.code.openTo)},{NL}
          {k("ships")}: <span className="tk-kw">true</span>,{"\n"}
          {"}"}
        </code>
      </pre>
    </figure>
  )
}

function About({ reduced }: { reduced: boolean }) {
  return (
    <section id="about" className="sec about" aria-labelledby="about-h">
      <RevealHeading id="about-h" text={ABOUT.heading} reduced={reduced} />
      <ScrollLitText className="about-statement" text={ABOUT.statement} reduced={reduced} />
      <div className="about-foot">
        <Rise reduced={reduced} className="about-body">
          <p>{ABOUT.body}</p>
        </Rise>
        <Rise reduced={reduced} i={1}>
          <CodeCard />
        </Rise>
      </div>
    </section>
  )
}

function Work({ reduced }: { reduced: boolean }) {
  return (
    <section id="work" className="work" aria-labelledby="work-h">
      <Gallery
        reduced={reduced}
        head={
          <div className="work-head">
            <RevealHeading id="work-h" text="Code and canvas." reduced={reduced} />
            <Rise reduced={reduced}>
              <p className="sec-lead">Engineering projects and paintings on one wall. Scroll to walk it; open any piece to look closer.</p>
            </Rise>
          </div>
        }
      />
    </section>
  )
}

function Tools({ reduced }: { reduced: boolean }) {
  return (
    <section id="tools" className="sec tools" aria-labelledby="tools-h">
      <RevealHeading id="tools-h" text="Tools of both trades." reduced={reduced} />
      <ul className="swatch-list">
        {TOOLS.map((m, i) => (
          <motion.li
            key={m.name}
            style={{ ["--pig" as string]: m.color }}
            initial={reduced ? false : { clipPath: "inset(0 100% 0 0)" }}
            whileInView={{ clipPath: "inset(0 0% 0 0)" }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ duration: 1.1, ease: EASE, delay: i * 0.08 }}
          >
            <span className="stroke" aria-hidden="true" />
            <span className="swatch-name">{m.name}</span>
            <span className="swatch-note">{m.note}</span>
            <code className="swatch-hex" aria-hidden="true">
              {m.color}
            </code>
          </motion.li>
        ))}
      </ul>
    </section>
  )
}

function Path({ reduced }: { reduced: boolean }) {
  return (
    <section id="path" className="sec path" aria-labelledby="path-h">
      <RevealHeading id="path-h" text="Path so far." reduced={reduced} />
      <ul className="wall-labels">
        {PATH.map((s, i) => (
          <Rise key={i} reduced={reduced} i={i}>
            <li className="wall-label">
              <span className="wl-kind">{s.kind}</span>
              <b>{s.title}</b>
              <span>{[s.venue, s.city].filter(Boolean).join(", ")}</span>
              <span className="wl-year">{s.year}</span>
            </li>
          </Rise>
        ))}
      </ul>
      {PATH_IS_PLACEHOLDER && <p className="placeholder-note">Placeholder labels. Roles, shows and education coming soon.</p>}
    </section>
  )
}

function Contact({ reduced }: { reduced: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(LINKS.email)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.location.href = `mailto:${LINKS.email}`
    }
  }
  const links: { label: string; detail: string; href: string | null; icon: React.ReactNode; ext?: boolean }[] = [
    { label: "GitHub", detail: "Code and experiments", href: LINKS.github, icon: <GithubLogo />, ext: true },
    { label: "LinkedIn", detail: "Experience and roles", href: LINKS.linkedin, icon: <LinkedinLogo />, ext: true },
    { label: "Instagram", detail: "Paintings and studio diary", href: LINKS.instagram, icon: <InstagramLogo />, ext: true },
    { label: "Email", detail: LINKS.email, href: `mailto:${LINKS.email}`, icon: <EnvelopeSimple /> },
  ]
  return (
    <section id="contact" className="contact" aria-labelledby="contact-h">
      <div className="contact-inner">
        <RevealHeading id="contact-h" text="Let's build something beautiful." reduced={reduced} />
        <Rise reduced={reduced}>
          <p className="contact-lead">{ARTIST.status}. Tell me about the product, the wall or the idea.</p>
        </Rise>
        <Rise reduced={reduced} i={1}>
          <div className="contact-email">
            <a href={`mailto:${LINKS.email}`}>{LINKS.email}</a>
            <button type="button" className="btn btn--paper copy" onClick={copy} aria-live="polite">
              {copied ? <Check weight="bold" aria-hidden="true" /> : <Copy weight="bold" aria-hidden="true" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
          {LINKS.placeholder && <p className="placeholder-note">Placeholder details. Final contact info is on the way.</p>}
        </Rise>
        <ul className="contact-links">
          {links.map((l, i) => (
            <motion.li
              key={l.label}
              initial={reduced ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: EASE, delay: i * 0.08 }}
            >
              {l.href ? (
                <a href={l.href} {...(l.ext ? { target: "_blank", rel: "noreferrer" } : {})}>
                  {l.icon}
                  <span className="cl-label">{l.label}</span>
                  <span className="cl-detail">{l.detail}</span>
                  <ArrowUpRight className="cl-arrow" aria-hidden="true" />
                </a>
              ) : (
                <span className="cl-off" aria-disabled="true">
                  {l.icon}
                  <span className="cl-label">{l.label}</span>
                  <span className="cl-detail">{l.detail}</span>
                </span>
              )}
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default function Page() {
  const reduced = useReducedMotion()
  const skipped = useIntroSkipped()
  const lenisRef = useRef<Lenis | null>(null)
  const siteRef = useRef<HTMLDivElement>(null)
  const [bloomed, setBloomed] = useState(false)
  const revealed = reduced || bloomed
  const progress = useElementProgress(siteRef, [
    [0, 0],
    [1, 1],
  ])
  const bar = useTransform(progress, (p) => p)

  useEffect(() => {
    document.documentElement.dataset.boot = revealed ? "done" : "hold"
    if (revealed) return
    const bail = setTimeout(() => setBloomed(true), 5000)
    return () => clearTimeout(bail)
  }, [revealed])

  // Smooth scrolling follows the visitor's own input, so it stays on with reduced motion too.
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.2 })
    lenisRef.current = lenis
    ;(window as unknown as { __lenis?: Lenis }).__lenis = lenis
    let frame = 0
    const raf = (t: number) => {
      lenis.raf(t)
      frame = requestAnimationFrame(raf)
    }
    frame = requestAnimationFrame(raf)
    return () => {
      cancelAnimationFrame(frame)
      lenis.destroy()
      lenisRef.current = null
      delete (window as unknown as { __lenis?: Lenis }).__lenis
    }
  }, [])

  const jump = useCallback(
    (id: string) => {
      const el = id === "top" ? document.body : document.getElementById(id)
      if (!el) return
      const lenis = lenisRef.current
      const cut = () => {
        if (lenis) lenis.scrollTo(id === "top" ? 0 : el, { offset: 0, immediate: true, force: true })
        else if (id === "top") window.scrollTo(0, 0)
        else el.scrollIntoView({ behavior: "auto" })
      }
      if (!reduced && "startViewTransition" in document) document.startViewTransition(cut)
      else if (lenis) lenis.scrollTo(id === "top" ? 0 : el, { offset: 0, duration: 1.4 })
      else cut()
      history.replaceState(null, "", id === "top" ? location.pathname : `#${id}`)
      const target = id === "top" ? document.getElementById("hero-name") : el.querySelector<HTMLElement>("h2")
      if (target) {
        target.setAttribute("tabindex", "-1")
        target.focus({ preventScroll: true })
      }
    },
    [reduced],
  )

  return (
    <div className="site" ref={siteRef}>
      <a className="skip" href="#about">
        Skip to content
      </a>
      {/* Rough, dragged edges for the medium swatches. */}
      <svg className="defs" width="0" height="0" aria-hidden="true" focusable="false">
        <filter id="brush" x="-5%" y="-30%" width="110%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.35" numOctaves="3" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <WetPaper reduced={reduced} boot={!skipped} onBloom={() => setBloomed(true)} />
      <motion.div className="progress" style={{ scaleX: bar }} aria-hidden="true" />
      <SwatchNav onJump={jump} />
      <Hero revealed={revealed} reduced={reduced} onJump={jump} />
      <main className="sheets">
        <About reduced={reduced} />
        <Work reduced={reduced} />
        <Tools reduced={reduced} />
        <Path reduced={reduced} />
      </main>
      <Contact reduced={reduced} />
    </div>
  )
}
