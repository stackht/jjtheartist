// Live brush telemetry shared between the wet paper and the readout under the hero.
// Plain mutable object: written every frame by the simulation, read a few times a second.
export const brushState = {
  x: 0,
  y: 0,
  pigment: "madder",
  fps: 0,
  live: false,
}

export const PIGMENT_HEX: Record<string, string> = {
  madder: "#c8342b",
  ultramarine: "#2d3bd1",
  ochre: "#e0a526",
  viridian: "#1f7a63",
  rose: "#e58aa6",
  ink: "#1b1c22",
}
