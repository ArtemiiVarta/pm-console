export interface TreemapRect {
  x: number
  y: number
  w: number
  h: number
}

interface Sized<T> {
  item: T
  area: number
}

/** Worst (largest) aspect ratio in a row laid along a side of length `side`. */
function worstRatio<T>(row: Sized<T>[], side: number): number {
  const sum = row.reduce((total, entry) => total + entry.area, 0)
  if (sum === 0 || side === 0) return Infinity
  const max = Math.max(...row.map((entry) => entry.area))
  const min = Math.min(...row.map((entry) => entry.area))
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min))
}

/** Places a finished row along the shorter side of `rect`; returns the space left. */
function placeRow<T>(row: Sized<T>[], rect: TreemapRect, out: (T & TreemapRect)[]): TreemapRect {
  const sum = row.reduce((total, entry) => total + entry.area, 0)
  if (rect.w >= rect.h) {
    // Column on the left.
    const width = rect.h === 0 ? 0 : sum / rect.h
    let y = rect.y
    for (const entry of row) {
      const height = width === 0 ? 0 : entry.area / width
      out.push({ ...entry.item, x: rect.x, y, w: width, h: height })
      y += height
    }
    return { x: rect.x + width, y: rect.y, w: rect.w - width, h: rect.h }
  }
  // Row along the top.
  const height = rect.w === 0 ? 0 : sum / rect.w
  let x = rect.x
  for (const entry of row) {
    const width = height === 0 ? 0 : entry.area / height
    out.push({ ...entry.item, x, y: rect.y, w: width, h: height })
    x += width
  }
  return { x: rect.x, y: rect.y + height, w: rect.w, h: rect.h - height }
}

/**
 * Squarified treemap (Bruls, Huizing & van Wijk): tiles with area proportional to `value`,
 * kept as close to square as possible, largest first. Coordinates are in the same units as
 * `width` × `height` (use 100 × 100 for percentages).
 */
export function squarify<T extends { value: number }>(
  items: T[],
  width: number,
  height: number,
): (T & TreemapRect)[] {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0)
  if (items.length === 0 || total === 0) return []
  const queue: Sized<T>[] = [...items]
    .sort((a, b) => b.value - a.value)
    .map((item) => ({ item, area: (Math.max(0, item.value) / total) * width * height }))

  const out: (T & TreemapRect)[] = []
  let rect: TreemapRect = { x: 0, y: 0, w: width, h: height }
  let row: Sized<T>[] = []
  while (queue.length > 0) {
    const next = queue[0]
    if (!next) break
    const side = Math.min(rect.w, rect.h)
    if (row.length === 0 || worstRatio([...row, next], side) <= worstRatio(row, side)) {
      row.push(next)
      queue.shift()
    } else {
      rect = placeRow(row, rect, out)
      row = []
    }
  }
  if (row.length > 0) placeRow(row, rect, out)
  return out
}

/**
 * Tile weights from revenue: projects without revenue still get a visible tile (at least 4% of
 * the largest), and when nobody has revenue all tiles are equal.
 */
export function getTileWeights(revenues: number[]): number[] {
  const max = Math.max(0, ...revenues)
  if (max === 0) return revenues.map(() => 1)
  return revenues.map((revenue) => Math.max(revenue, max * 0.04))
}
