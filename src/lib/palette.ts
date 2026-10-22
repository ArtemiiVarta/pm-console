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

/** Default star color for new milestones (yellow-600). */
export const MILESTONE_COLOR = '#CA8A04'

/** Swatches offered by the color picker: the phase palette plus gold and red for milestones. */
export const COLOR_CHOICES = [...PHASE_PALETTE, MILESTONE_COLOR, '#DC2626'] as const

const COLOR_NAMES: Record<string, string> = {
  '#2563EB': 'Blue',
  '#0D9488': 'Teal',
  '#7C3AED': 'Violet',
  '#DB2777': 'Pink',
  '#0E7490': 'Cyan',
  '#4D7C0F': 'Green',
  '#C2410C': 'Orange',
  '#475569': 'Slate',
  '#CA8A04': 'Gold',
  '#DC2626': 'Red',
}

/** Human name for a swatch, or the hex code for a custom color. */
export function getColorName(color: string): string {
  return COLOR_NAMES[color.toUpperCase()] ?? color.toUpperCase()
}

/** True for a 6-digit hex color like #1A2B3C. */
export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
}
