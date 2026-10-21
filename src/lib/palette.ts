/**
 * Eight phase colors, assigned in order and then repeated. Each passes 3:1 contrast against
 * white, they stay distinguishable from each other, and none matches the success/warning/danger
 * tokens, so a phase color is never mistaken for a status.
 */
export const PHASE_PALETTE = [
  '#2563EB', // blue-600
  '#0D9488', // teal-600
  '#7C3AED', // violet-600
  '#DB2777', // pink-600
  '#0E7490', // cyan-700
  '#4D7C0F', // lime-700
  '#C2410C', // orange-700
  '#475569', // slate-600
] as const

/** Color for the phase at `index` (0-based), cycling through the palette. */
export function getPhaseColor(index: number): string {
  const size = PHASE_PALETTE.length
  return PHASE_PALETTE[((index % size) + size) % size] ?? PHASE_PALETTE[0]
}
