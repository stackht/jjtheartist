"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { motion } from "framer-motion"
import { ArrowRight, ArrowUpRight, Check, Copy, EnvelopeSimple, GithubLogo, InstagramLogo, LinkedinLogo } from "@phosphor-icons/react"
import { ABOUT, ARTIST, LINKS, PATH, PATH_IS_PLACEHOLDER, TOOLS, WORKS, WORKS_ARE_SAMPLES } from "@/content/site"
import { brushState, PIGMENT_HEX } from "./brushState"
import { Painting } from "./works"

const EASE = [0.16, 1, 0.3, 1] as const

/** The sections, one per spread, with the pigment of each index tab. */
export const SPREADS = [
  { id: "cover", label: "Hello", pigment: "#1b1c22" },
  { id: "about", label: "About", pigment: "#c8342b" },
  { id: "work", label: "Work", pigment: "#2d3bd1" },
  { id: "tools", label: "Tools", pigment: "#e0a526" },
  { id: "path", label: "Path", pigment: "#1f7a63" },
  { id: "contact", label: "Contact", pigment: "#e58aa6" },
] as const

/** One page of the book: running head, body and folio, on dot-grid paper. */
function Sheet({
  side,
  folio,
  head,
  className = "",
  children,
}: {
  side: "left" | "right"
  folio: number
  head: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`sheet sheet--${side} ${className}`}>
      <p className="sheet-head" aria-hidden="true">
        {head}
      </p>
      <div className="sheet-body" data-scroll>
        {children}
      </div>
      <p className="folio" aria-hidden="true">
        {folio}
      </p>
    </div>
  )
}

/** The name inks onto the page letter by letter. */
function InkName({ revealed }: { revealed: boolean }) {
  let n = 0
  return (
    <h1 id="cover-h" className="cover-name" aria-label={ARTIST.name} tabIndex={-1}>
      {[ARTIST.first, ARTIST.last].map((word) => (
        <span key={word} className="name-line" aria-hidden="true">
          {[...word].map((ch, i) => {
            const k = n++
            return (
              <motion.span
                key={i}
                className="ink-letter"
                initial={{ opacity: 0, scaleX: 0.7, y: "0.12em" }}
                animate={revealed ? { opacity: 1, scaleX: 1, y: "0em" } : undefined}
                transition={{ duration: 1.3, ease: EASE, delay: 0.05 * k }}
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

/** An engineer's readout of the brush: position, pigment and frame rate. */
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

// A line break plus two-space indent inside the code card.
const NL = "\n  "

/** Her facts, written the way she'd write them at work. */
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
    <figure className="code-card taped">
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

function CopyEmail() {
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
  return (
    <div className="contact-email">
      <a href={`mailto:${LINKS.email}`}>{LINKS.email}</a>
      <button type="button" className="btn btn--paper btn--sm" onClick={copy} aria-live="polite">
        {copied ? <Check weight="bold" aria-hidden="true" /> : <Copy weight="bold" aria-hidden="true" />}
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  )
}

export type PageCtx = {
  revealed: boolean
  selected: number
  onSelect: (i: number) => void
  onOpenWork: (i: number, x: number, y: number) => void
  onGo: (spread: number) => void
}

/** Every page of the book, in order: page 2n and 2n+1 make spread n. */
export function buildPages({ revealed, selected, onSelect, onOpenWork, onGo }: PageCtx): ReactNode[] {
  const work = WORKS[selected]
  const portrait = work.style !== "interface"
  const show = (i: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: revealed ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 1, ease: EASE, delay: 0.7 + i * 0.1 },
  })

  return [
    // ── Spread 0: the cover. The right page is a window onto the wet paper underneath.
    <Sheet key="p1" side="left" folio={1} head="Sketchbook · vol. 1">
      <motion.p className="hand cover-kicker" {...show(0)}>
        property of
      </motion.p>
      <InkName revealed={revealed} />
      <motion.div className="cover-copy" {...show(1)}>
        <p className="cover-role">{ARTIST.role}</p>
        <p className="cover-line">{ARTIST.line}</p>
      </motion.div>
      <motion.div className="cover-actions" {...show(2)}>
        <button type="button" className="btn btn--ink" onClick={() => onGo(1)}>
          Open the book <ArrowRight weight="bold" aria-hidden="true" />
        </button>
        <button type="button" className="btn btn--paper" onClick={() => onGo(5)}>
          Say hello
        </button>
      </motion.div>
      <motion.div className="cover-foot" {...show(3)}>
        <BrushReadout />
      </motion.div>
    </Sheet>,
    <Sheet key="p2" side="right" folio={2} head="fig. 1" className="sheet--window">
      <p className="window-caption">
        <span className="hand">fig. 1</span>
        <code>wet paper · live simulation</code>
      </p>
    </Sheet>,

    // ── Spread 1: about.
    <Sheet key="p3" side="left" folio={3} head="About">
      <h2 id="about-h" className="page-title" tabIndex={-1}>
        {ABOUT.heading}
      </h2>
      <p className="about-statement">{ABOUT.statement}</p>
      <p className="about-body">{ABOUT.body}</p>
    </Sheet>,
    <Sheet key="p4" side="right" folio={4} head="About">
      <p className="hand note note--arrow">how I&apos;d describe myself at work ↓</p>
      <CodeCard />
      <p className="hand note">today&apos;s palette</p>
      <ul className="palette" aria-label="Today's palette">
        {(["madder", "ultramarine", "ochre", "viridian", "rose", "ink"] as const).map((p) => (
          <li key={p} style={{ ["--pig" as string]: PIGMENT_HEX[p] }}>
            <i aria-hidden="true" />
            <span>{p}</span>
            <code>{PIGMENT_HEX[p]}</code>
          </li>
        ))}
      </ul>
    </Sheet>,

    // ── Spread 2: work. An index on the left, the chosen piece on the facing page.
    <Sheet key="p5" side="left" folio={5} head="Work">
      <h2 id="work-h" className="page-title" tabIndex={-1}>
        Code and canvas.
      </h2>
      <p className="page-lead">Engineering projects and paintings, kept in one book. Pick one to see it up close.</p>
      <ol className="work-index">
        {WORKS.map((w, i) => (
          <li key={w.id}>
            <button type="button" aria-pressed={i === selected} onClick={() => onSelect(i)}>
              <span className="wi-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="wi-title">{w.title}</span>
              <span className={`tag tag--${w.kind === "Engineering" ? "eng" : "art"}`}>{w.kind}</span>
              <span className="wi-year">{w.year}</span>
            </button>
          </li>
        ))}
      </ol>
      {WORKS_ARE_SAMPLES && <p className="placeholder-note">Sample projects and paintings, generated for this preview.</p>}
    </Sheet>,
    <Sheet key="p6" side="right" folio={6} head="Work">
      <figure className="piece" key={work.id}>
        <button
          type="button"
          className={`mat taped ${portrait ? "mat--portrait" : "mat--landscape"}`}
          onClick={(e) => onOpenWork(selected, e.clientX, e.clientY)}
          aria-label={`Open ${work.title} full screen`}
        >
          <Painting work={work} seed={selected * 7919 + 11} w={portrait ? 760 : 900} h={portrait ? 960 : 760} eager />
        </button>
        <figcaption>
          <span className={`tag tag--${work.kind === "Engineering" ? "eng" : "art"}`}>{work.kind}</span>
          <b>{work.title}</b>
          <span className="piece-meta">
            {work.medium}, {work.year}
          </span>
          {work.desc && <span className="piece-desc">{work.desc}</span>}
          {work.stack && (
            <span className="piece-stack">
              {work.stack.map((t) => (
                <code key={t}>{t}</code>
              ))}
            </span>
          )}
        </figcaption>
      </figure>
      <p className="hand note">click the piece to see it full size</p>
    </Sheet>,

    // ── Spread 3: tools.
    <Sheet key="p7" side="left" folio={7} head="Tools">
      <h2 id="tools-h" className="page-title" tabIndex={-1}>
        Tools of both trades.
      </h2>
      <p className="page-lead">Half the kit ships software; the other half stains my fingers. Both get used every week, and each makes me better at the other.</p>
      <p className="hand note note--big">same eye, two hands</p>
    </Sheet>,
    <Sheet key="p8" side="right" folio={8} head="Tools">
      <ul className="swatch-list">
        {TOOLS.map((m) => (
          <li key={m.name} style={{ ["--pig" as string]: m.color }}>
            <span className="stroke" aria-hidden="true" />
            <span className="swatch-name">{m.name}</span>
            <span className="swatch-note">{m.note}</span>
            <code className="swatch-hex" aria-hidden="true">
              {m.color}
            </code>
          </li>
        ))}
      </ul>
    </Sheet>,

    // ── Spread 4: path.
    <Sheet key="p9" side="left" folio={9} head="Path">
      <h2 id="path-h" className="page-title" tabIndex={-1}>
        Path so far.
      </h2>
      <p className="page-lead">Work, shows and school, in the order they happened.</p>
      {PATH_IS_PLACEHOLDER && <p className="placeholder-note">Placeholder entries. Roles, shows and education coming soon.</p>}
    </Sheet>,
    <Sheet key="p10" side="right" folio={10} head="Path">
      <ol className="timeline">
        {PATH.map((s, i) => (
          <li key={i}>
            <span className="tl-dot" aria-hidden="true" />
            <span className="tl-kind">{s.kind}</span>
            <b>{s.title}</b>
            <span>{[s.venue, s.city].filter(Boolean).join(", ")}</span>
            <span className="tl-year">{s.year}</span>
          </li>
        ))}
      </ol>
    </Sheet>,

    // ── Spread 5: contact.
    <Sheet key="p11" side="left" folio={11} head="Contact">
      <h2 id="contact-h" className="page-title page-title--big" tabIndex={-1}>
        Let&apos;s build something beautiful.
      </h2>
      <p className="page-lead">{ARTIST.status}. Tell me about the product, the wall or the idea.</p>
      <CopyEmail />
      {LINKS.placeholder && <p className="placeholder-note">Placeholder details. Final contact info is on the way.</p>}
    </Sheet>,
    <Sheet key="p12" side="right" folio={12} head="Contact">
      <ul className="contact-links">
        {[
          { label: "GitHub", detail: "Code and experiments", href: LINKS.github, icon: <GithubLogo /> },
          { label: "LinkedIn", detail: "Experience and roles", href: LINKS.linkedin, icon: <LinkedinLogo /> },
          { label: "Instagram", detail: "Paintings and studio diary", href: LINKS.instagram, icon: <InstagramLogo /> },
          { label: "Email", detail: LINKS.email, href: `mailto:${LINKS.email}`, icon: <EnvelopeSimple /> },
        ].map((l) => (
          <li key={l.label}>
            <a href={l.href} {...(l.href.startsWith("mailto") ? {} : { target: "_blank", rel: "noreferrer" })}>
              {l.icon}
              <span className="cl-label">{l.label}</span>
              <span className="cl-detail">{l.detail}</span>
              <ArrowUpRight className="cl-arrow" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
      <p className="signature">Janhavi</p>
    </Sheet>,
  ]
}
