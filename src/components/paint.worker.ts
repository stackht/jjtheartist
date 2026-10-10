// Paints the sample artworks off the main thread, so scrolling never waits on them.
import { paint } from "./paintings"
import type { ArtStyle } from "@/content/site"

type Job = { canvas: OffscreenCanvas; w: number; h: number; style: ArtStyle; palette: string[]; seed: number }

self.onmessage = (e: MessageEvent<Job>) => {
  const { canvas, w, h, style, palette, seed } = e.data
  const ctx = canvas.getContext("2d")
  if (ctx) paint(ctx, w, h, style, palette, seed)
}
