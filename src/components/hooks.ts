"use client"

import { useSyncExternalStore } from "react"

const noop = () => () => {}
const introSkipped = () => document.documentElement.dataset.intro === "skip"

/** True when the opening drop already played this session (set before paint in layout.tsx). */
export function useIntroSkipped() {
  return useSyncExternalStore(noop, introSkipped, () => false)
}
