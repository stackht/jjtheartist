// Sample paintings drawn on canvas, used until real artwork images are added.
// Washes use the layered deformed-polygon watercolour technique: many translucent,
// recursively roughened copies of a shape, multiplied onto textured paper.

import type { ArtStyle } from "@/content/site"

type Pt = [number, number]
/** Works on the page or inside a worker (OffscreenCanvas). */
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const gauss = (rnd: () => number) => {
  let u = 0
  let v = 0
  while (u === 0) u = rnd()
  while (v === 0) v = rnd()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Midpoint displacement: each pass inserts a jittered point between neighbours. */
function deform(poly: Pt[], passes: number, amount: number, rnd: () => number): Pt[] {
  let p = poly
  for (let k = 0; k < passes; k++) {
    const out: Pt[] = []
    for (let i = 0; i < p.length; i++) {
      const a = p[i]
      const b = p[(i + 1) % p.length]
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      out.push(a, [(a[0] + b[0]) / 2 + gauss(rnd) * len * amount, (a[1] + b[1]) / 2 + gauss(rnd) * len * amount])
    }
    p = out
  }
  return p
}

const polygon = (cx: number, cy: number, rx: number, ry: number, n = 10): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt
  })

const fill = (ctx: Ctx, p: Pt[]) => {
  ctx.beginPath()
  p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.fill()
}

/** One watercolour wash: ~25 translucent roughened layers of the same base shape. */
function wash(ctx: Ctx, base: Pt[], color: string, rnd: () => number, layers = 24, alpha = 0.045) {
  const rough = deform(base, 3, 0.45, rnd)
  ctx.save()
  ctx.globalCompositeOperation = "multiply"
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  for (let i = 0; i < layers; i++) fill(ctx, deform(rough, 3, 0.32, rnd))
  ctx.restore()
}

function paper(ctx: Ctx, w: number, h: number, rnd: () => number) {
  ctx.fillStyle = "#f4f3ef"
  ctx.fillRect(0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const g = (rnd() - 0.5) * 10
    d[i] += g
    d[i + 1] += g
    d[i + 2] += g
  }
  ctx.putImageData(img, 0, 0)
}

function strokeLine(ctx: Ctx, pts: Pt[]) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.stroke()
}

/** A loaded brush dragged along a curve: many offset bristles, thinning out. */
function brush(ctx: Ctx, path: Pt[], width: number, color: string, rnd: () => number) {
  ctx.save()
  ctx.globalCompositeOperation = "multiply"
  ctx.strokeStyle = color
  ctx.lineCap = "round"
  const bristles = Math.round(width / 2.2)
  for (let b = 0; b < bristles; b++) {
    const off = (b / bristles - 0.5) * width
    const dryAt = 0.55 + rnd() * 0.45
    ctx.globalAlpha = 0.12 + rnd() * 0.22
    ctx.lineWidth = 1 + rnd() * 2.2
    const pts: Pt[] = []
    for (let i = 0; i < path.length; i++) {
      if (i / path.length > dryAt) break
      const [x, y] = path[i]
      const [nx, ny] = path[Math.min(path.length - 1, i + 1)]
      const a = Math.atan2(ny - y, nx - x) + Math.PI / 2
      pts.push([x + Math.cos(a) * off + gauss(rnd) * 0.6, y + Math.sin(a) * off + gauss(rnd) * 0.6])
    }
    strokeLine(ctx, pts)
  }
  ctx.restore()
}

const curve = (a: Pt, c: Pt, b: Pt, n = 60): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const u = 1 - t
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as Pt
  })

/** A hand-inked line: slightly wobbly, like a pen on paper. */
function inkLine(ctx: Ctx, a: Pt, b: Pt, rnd: () => number, wob = 0.8) {
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 14))
  const pts: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push([a[0] + (b[0] - a[0]) * t + gauss(rnd) * wob, a[1] + (b[1] - a[1]) * t + gauss(rnd) * wob])
  }
  strokeLine(ctx, pts)
}

function inkRect(ctx: Ctx, x: number, y: number, w: number, h: number, rnd: () => number) {
  inkLine(ctx, [x, y], [x + w, y], rnd)
  inkLine(ctx, [x + w, y], [x + w, y + h], rnd)
  inkLine(ctx, [x + w, y + h], [x, y + h], rnd)
  inkLine(ctx, [x, y + h], [x, y], rnd)
}

/** A designer's redline: a dimension line with end ticks and a measurement label. */
function redline(ctx: Ctx, a: Pt, b: Pt, label: string, s: number, rnd: () => number) {
  ctx.save()
  ctx.strokeStyle = "#c8342b"
  ctx.fillStyle = "#c8342b"
  ctx.lineWidth = Math.max(1, s * 0.0022)
  ctx.globalAlpha = 0.9
  inkLine(ctx, a, b, rnd, 0.3)
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2
  const t = s * 0.014
  for (const p of [a, b]) inkLine(ctx, [p[0] + Math.cos(ang) * t, p[1] + Math.sin(ang) * t], [p[0] - Math.cos(ang) * t, p[1] - Math.sin(ang) * t], rnd, 0.2)
  ctx.font = `600 ${Math.round(s * 0.028)}px ui-monospace, "JetBrains Mono", monospace`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const mx = (a[0] + b[0]) / 2 + Math.cos(ang) * t * 1.9
  const my = (a[1] + b[1]) / 2 + Math.sin(ang) * t * 1.9
  ctx.fillText(label, mx, my)
  ctx.restore()
}

export function paint(ctx: Ctx, w: number, h: number, style: ArtStyle, palette: readonly string[], seed: number) {
  const rnd = mulberry32(seed)
  paper(ctx, w, h, rnd)
  const [c1, c2, c3] = palette
  const s = Math.min(w, h)

  if (style === "bloom") {
    // Wet-into-wet: overlapping blooms that bleed into each other.
    for (let i = 0; i < 9; i++) {
      const col = [c1, c2, c3][i % 3]
      wash(ctx, polygon(w * (0.15 + rnd() * 0.7), h * (0.15 + rnd() * 0.7), s * (0.12 + rnd() * 0.16), s * (0.1 + rnd() * 0.16)), col, rnd)
    }
    ctx.save()
    ctx.globalCompositeOperation = "multiply"
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = [c1, c2][i % 2]
      ctx.globalAlpha = 0.25 + rnd() * 0.4
      ctx.beginPath()
      ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  } else if (style === "field") {
    // Soft colour fields stacked like a quiet abstract.
    const bands = [
      [0.08, 0.08, 0.84, 0.42, c1],
      [0.1, 0.55, 0.8, 0.22, c2],
      [0.08, 0.8, 0.84, 0.13, c3],
    ] as const
    for (const [x, y, bw, bh, col] of bands) {
      const r: Pt[] = [
        [w * x, h * y],
        [w * (x + bw), h * y],
        [w * (x + bw), h * (y + bh)],
        [w * x, h * (y + bh)],
      ]
      wash(ctx, r, col, rnd, 30, 0.05)
    }
  } else if (style === "gesture") {
    // Loaded brush gestures over a light wash.
    wash(ctx, polygon(w * 0.5, h * 0.55, w * 0.42, h * 0.3), c2, rnd, 18, 0.03)
    for (let i = 0; i < 7; i++) {
      const a: Pt = [rnd() * w, h * (0.2 + rnd() * 0.6)]
      const b: Pt = [rnd() * w, h * (0.2 + rnd() * 0.6)]
      const c: Pt = [(a[0] + b[0]) / 2 + (rnd() - 0.5) * w * 0.5, (a[1] + b[1]) / 2 + (rnd() - 0.5) * h * 0.5]
      brush(ctx, curve(a, c, b), s * (0.05 + rnd() * 0.07), [c1, c3, c1, "#1b1c22"][i % 4], rnd)
    }
  } else if (style === "botanical") {
    // Leaves in wash with ink stems and veins.
    for (let i = 0; i < 11; i++) {
      const cx = w * (0.15 + rnd() * 0.7)
      const cy = h * (0.15 + rnd() * 0.7)
      const ang = rnd() * Math.PI
      const L = s * (0.12 + rnd() * 0.12)
      const leaf: Pt[] = Array.from({ length: 12 }, (_, k) => {
        const t = (k / 12) * Math.PI * 2
        const lx = Math.cos(t) * L
        const ly = Math.sin(t) * L * 0.36 * Math.abs(Math.cos(t * 0.5))
        return [cx + lx * Math.cos(ang) - ly * Math.sin(ang), cy + lx * Math.sin(ang) + ly * Math.cos(ang)] as Pt
      })
      wash(ctx, leaf, i % 4 === 0 ? c2 : c1, rnd, 16, 0.06)
      ctx.save()
      ctx.strokeStyle = "#1b1c22"
      ctx.globalAlpha = 0.55
      ctx.lineWidth = 1.2
      strokeLine(ctx, [
        [cx - Math.cos(ang) * L, cy - Math.sin(ang) * L],
        [cx + Math.cos(ang) * L, cy + Math.sin(ang) * L],
      ])
      ctx.restore()
    }
    for (let i = 0; i < 5; i++) wash(ctx, polygon(w * (0.2 + rnd() * 0.6), h * (0.2 + rnd() * 0.6), s * 0.04, s * 0.04), c3, rnd, 14, 0.08)
  } else if (style === "horizon") {
    // Layered ridges receding into mist, with a low sun.
    wash(ctx, polygon(w * 0.68, h * 0.3, s * 0.1, s * 0.1), c3, rnd, 20, 0.06)
    for (let k = 0; k < 5; k++) {
      const top = h * (0.35 + k * 0.12)
      const ridge: Pt[] = [[-20, h + 20]]
      for (let x = 0; x <= 10; x++) ridge.push([(x / 10) * (w + 40) - 20, top + Math.sin(x * 0.9 + k) * h * 0.05 + (rnd() - 0.5) * h * 0.04])
      ridge.push([w + 20, h + 20])
      wash(ctx, ridge, k % 2 ? c2 : c1, rnd, 16, 0.03 + k * 0.012)
    }
  } else if (style === "interface") {
    // Engineering meets paint: an app screen inked over loose washes, with designer redlines.
    wash(ctx, polygon(w * 0.3, h * 0.35, s * 0.32, s * 0.24), c1, rnd, 18, 0.035)
    wash(ctx, polygon(w * 0.72, h * 0.7, s * 0.3, s * 0.22), c2, rnd, 18, 0.035)
    const fx = w * 0.12
    const fy = h * 0.14
    const fw = w * 0.76
    const fh = h * 0.7
    ctx.save()
    ctx.strokeStyle = "#1b1c22"
    ctx.globalAlpha = 0.85
    ctx.lineWidth = Math.max(1.2, s * 0.0035)
    inkRect(ctx, fx, fy, fw, fh, rnd)
    inkLine(ctx, [fx, fy + fh * 0.09], [fx + fw, fy + fh * 0.09], rnd)
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(fx + fw * 0.04 + i * fw * 0.035, fy + fh * 0.045, s * 0.008, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
    // Nav bar, hero panel, three cards, text lines.
    const pad = fw * 0.06
    const heroY = fy + fh * 0.16
    const heroH = fh * 0.34
    wash(ctx, [[fx + pad, heroY], [fx + fw - pad, heroY], [fx + fw - pad, heroY + heroH], [fx + pad, heroY + heroH]], c1, rnd, 14, 0.06)
    const cardY = heroY + heroH + fh * 0.08
    const cardH = fh * 0.3
    const gap = fw * 0.035
    const cardW = (fw - pad * 2 - gap * 2) / 3
    for (let i = 0; i < 3; i++) {
      const cx = fx + pad + i * (cardW + gap)
      wash(ctx, [[cx, cardY], [cx + cardW, cardY], [cx + cardW, cardY + cardH * 0.55], [cx, cardY + cardH * 0.55]], [c2, c3, c2][i], rnd, 12, 0.07)
      ctx.save()
      ctx.strokeStyle = "#1b1c22"
      ctx.globalAlpha = 0.75
      ctx.lineWidth = Math.max(1, s * 0.0028)
      inkRect(ctx, cx, cardY, cardW, cardH, rnd)
      for (let k = 0; k < 2; k++) inkLine(ctx, [cx + cardW * 0.08, cardY + cardH * (0.68 + k * 0.13)], [cx + cardW * (0.75 - k * 0.25), cardY + cardH * (0.68 + k * 0.13)], rnd)
      ctx.restore()
    }
    ctx.save()
    ctx.strokeStyle = "#1b1c22"
    ctx.globalAlpha = 0.8
    ctx.lineWidth = Math.max(1.5, s * 0.006)
    inkLine(ctx, [fx + pad * 1.6, heroY + heroH * 0.35], [fx + fw * 0.55, heroY + heroH * 0.35], rnd)
    ctx.lineWidth = Math.max(1, s * 0.003)
    inkLine(ctx, [fx + pad * 1.6, heroY + heroH * 0.58], [fx + fw * 0.45, heroY + heroH * 0.58], rnd)
    ctx.restore()
    // Spec redlines: card width, gutter, and hero padding.
    redline(ctx, [fx + pad, cardY + cardH + fh * 0.05], [fx + pad + cardW, cardY + cardH + fh * 0.05], "1fr", s, rnd)
    redline(ctx, [fx + pad + cardW, cardY - fh * 0.03], [fx + pad + cardW + gap, cardY - fh * 0.03], "24", s, rnd)
    redline(ctx, [fx + fw - pad * 0.15, heroY], [fx + fw - pad * 0.15, heroY + heroH], "8px", s, rnd)
  } else {
    // Torn paper collage with ink marks.
    for (let i = 0; i < 7; i++) {
      const x = w * (0.08 + rnd() * 0.6)
      const y = h * (0.08 + rnd() * 0.6)
      const rw = w * (0.18 + rnd() * 0.3)
      const rh = h * (0.14 + rnd() * 0.3)
      const torn = deform(
        [
          [x, y],
          [x + rw, y],
          [x + rw, y + rh],
          [x, y + rh],
        ],
        4,
        0.08,
        rnd,
      )
      ctx.save()
      ctx.globalCompositeOperation = "multiply"
      ctx.fillStyle = [c1, c2, c3][i % 3]
      ctx.globalAlpha = 0.75
      ctx.shadowColor = "rgba(20,20,30,0.18)"
      ctx.shadowBlur = 8
      ctx.shadowOffsetY = 3
      fill(ctx, torn)
      ctx.restore()
    }
    ctx.save()
    ctx.strokeStyle = "#1b1c22"
    ctx.globalAlpha = 0.7
    for (let i = 0; i < 4; i++) {
      ctx.lineWidth = 1.5 + rnd() * 2
      const a: Pt = [rnd() * w, rnd() * h]
      strokeLine(ctx, curve(a, [rnd() * w, rnd() * h], [rnd() * w, rnd() * h], 40))
    }
    ctx.restore()
  }

  // A soft vignette, like a painting under gallery light.
  const g = ctx.createRadialGradient(w / 2, h / 2, s * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6)
  g.addColorStop(0, "rgba(0,0,0,0)")
  g.addColorStop(1, "rgba(40,30,20,0.12)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

/** The dominant colour of a work, used to flood the screen when it opens. */
export const dominant = (palette: readonly string[]) => palette[0]
