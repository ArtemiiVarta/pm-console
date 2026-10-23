import { getTileWeights, squarify } from '@/lib/treemap'

const area = (r: { w: number; h: number }) => r.w * r.h

describe('squarify', () => {
  it('gives each tile an area proportional to its value and fills the box', () => {
    const tiles = squarify(
      [
        { id: 'a', value: 50 },
        { id: 'b', value: 30 },
        { id: 'c', value: 20 },
      ],
      100,
      100,
    )
    const byId = Object.fromEntries(tiles.map((t) => [t.id, t]))
    expect(area(byId.a!)).toBeCloseTo(5000)
    expect(area(byId.b!)).toBeCloseTo(3000)
    expect(area(byId.c!)).toBeCloseTo(2000)
    expect(tiles.reduce((sum, t) => sum + area(t), 0)).toBeCloseTo(10000)
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(-1e-9)
      expect(t.y).toBeGreaterThanOrEqual(-1e-9)
      expect(t.x + t.w).toBeLessThanOrEqual(100 + 1e-9)
      expect(t.y + t.h).toBeLessThanOrEqual(100 + 1e-9)
    }
  })

  it('places the largest first and keeps tiles reasonably square', () => {
    const tiles = squarify(
      Array.from({ length: 12 }, (_, i) => ({ id: String(i), value: 12 - i })),
      100,
      60,
    )
    expect(tiles[0]?.id).toBe('0')
    const worst = Math.max(...tiles.map((t) => Math.max(t.w / t.h, t.h / t.w)))
    expect(worst).toBeLessThan(4)
  })

  it('returns nothing for no items or zero total', () => {
    expect(squarify([], 100, 100)).toEqual([])
    expect(squarify([{ value: 0 }], 100, 100)).toEqual([])
  })
})

describe('getTileWeights', () => {
  it('keeps zero-revenue projects visible and equalizes when nobody has revenue', () => {
    expect(getTileWeights([1000, 0, 500])).toEqual([1000, 40, 500])
    expect(getTileWeights([0, 0])).toEqual([1, 1])
  })
})
