// All visitor-facing content lives here.
// PLACEHOLDERS: projects, artworks, experience, email and links are stand-ins.
// Replace them with Janhavi's real details, then flip the `placeholder` flags to false.

export const ARTIST = {
  name: "Janhavi Jadhav",
  first: "Janhavi",
  last: "Jadhav",
  role: "Software & UI engineer who paints",
  line: "I build interfaces with an engineer's precision and a painter's eye, and I paint whatever light I can't stop looking at.",
  status: "Open to product, UI and frontend roles, and to art commissions",
}

export const LINKS: {
  email: string
  github: string
  linkedin: string
  instagram: string
  /** While true, the contact section says these details are placeholders. */
  placeholder: boolean
} = {
  email: "hello@janhavijadhav.dev",
  github: "https://github.com/",
  linkedin: "https://linkedin.com/",
  instagram: "https://instagram.com/",
  placeholder: true,
}

export const NAV = [
  { id: "about", label: "About", pigment: "madder" },
  { id: "work", label: "Work", pigment: "ultramarine" },
  { id: "tools", label: "Tools", pigment: "ochre" },
  { id: "path", label: "Path", pigment: "viridian" },
  { id: "contact", label: "Contact", pigment: "ink" },
] as const

export const ABOUT = {
  heading: "Precise, and a little wet.",
  statement:
    "I'm Janhavi, a software and UI engineer who paints. By day I build interfaces that feel effortless; in the evenings I chase light in watercolour. Both are the same habit: noticing what makes something feel alive.",
  body: "I care about the parts people feel but rarely name: the timing of a transition, the weight of a colour, the way a layout breathes. Painting taught me to look; engineering taught me to build what I see, and to make it hold up.",
  /** Shown as a small code card. */
  code: {
    role: "Software & UI engineer",
    stack: ["TypeScript", "React", "Figma"],
    paints: ["watercolour", "gouache", "ink"],
    openTo: ["product roles", "commissions"],
  },
}

export type ArtStyle = "bloom" | "field" | "gesture" | "botanical" | "horizon" | "collage" | "interface"
export type WorkKind = "Engineering" | "Art"

/**
 * Projects and artworks share one wall. Covers are generated on canvas until real images are
 * added (set `image` to a path in /public, e.g. "/works/monsoon.jpg").
 */
export const WORKS: {
  id: string
  kind: WorkKind
  title: string
  /** Art: the medium. Engineering: what it is. */
  medium: string
  year: string
  style: ArtStyle
  palette: [string, string, string]
  /** Engineering only: what it does and the stack it uses. */
  desc?: string
  stack?: string[]
  image?: string
}[] = [
  {
    id: "pigment",
    kind: "Engineering",
    title: "Pigment",
    medium: "Colour-palette app",
    year: "2025",
    style: "interface",
    palette: ["#2d3bd1", "#c8342b", "#e0a526"],
    desc: "Pull a palette from any photo, check its contrast for accessibility, and export it as design tokens.",
    stack: ["React", "TypeScript", "Canvas API"],
  },
  { id: "monsoon", kind: "Art", title: "Monsoon Study", medium: "Watercolour on paper", year: "2025", style: "bloom", palette: ["#2d3bd1", "#1f7a63", "#e0a526"] },
  {
    id: "studio",
    kind: "Engineering",
    title: "Studio Kit",
    medium: "Design system",
    year: "2024",
    style: "interface",
    palette: ["#1f7a63", "#e0a526", "#2d3bd1"],
    desc: "A small design system with tokens, components and motion guidelines, documented and themed for three products.",
    stack: ["Figma", "React", "Storybook"],
  },
  { id: "market", kind: "Art", title: "Market at Dusk", medium: "Gouache", year: "2025", style: "gesture", palette: ["#c8342b", "#e0a526", "#2d3bd1"] },
  {
    id: "gallery",
    kind: "Engineering",
    title: "Open Walls",
    medium: "Gallery booking platform",
    year: "2024",
    style: "interface",
    palette: ["#c8342b", "#2d3bd1", "#1f7a63"],
    desc: "Lets small galleries list exhibitions and take visit bookings, with a calm, image-first interface.",
    stack: ["Next.js", "Node.js", "PostgreSQL"],
  },
  { id: "garden", kind: "Art", title: "Courtyard Garden", medium: "Ink and watercolour", year: "2024", style: "botanical", palette: ["#1f7a63", "#c8342b", "#e0a526"] },
  { id: "ghats", kind: "Art", title: "Western Ghats", medium: "Watercolour", year: "2024", style: "horizon", palette: ["#1f7a63", "#2d3bd1", "#e8b4c8"] },
]
export const WORKS_ARE_SAMPLES = true

/** Tools of both trades, shown as brushed swatches. */
export const TOOLS = [
  { name: "TypeScript & React", note: "Interfaces that are fast, typed and accessible", color: "#2d3bd1" },
  { name: "Figma & design systems", note: "Tokens, components, motion specs", color: "#c8342b" },
  { name: "Motion & WebGL", note: "Transitions with weight, and a little physics", color: "#1b1c22" },
  { name: "Watercolour & gouache", note: "Wet into wet, edges left to chance", color: "#e0a526" },
  { name: "Ink & sketchbooks", note: "Where most ideas start, on paper and on screen", color: "#1f7a63" },
] as const

/** Placeholder wall labels: replace with real roles, shows and awards. */
export const PATH = [
  { title: "Software Engineer", venue: "Company name", city: "City", year: "Year to present", kind: "Work" },
  { title: "UI/UX Engineering Intern", venue: "Company name", city: "City", year: "Year", kind: "Work" },
  { title: "Exhibition title", venue: "Gallery or venue", city: "City", year: "Year", kind: "Show" },
  { title: "B.E. / B.Tech, Computer Engineering", venue: "College or university", city: "City", year: "Year", kind: "Education" },
] as const
export const PATH_IS_PLACEHOLDER = true
