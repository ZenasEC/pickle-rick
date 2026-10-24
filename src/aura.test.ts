// Tests for the aura layer. Plain numbers only, no browser needed.
import { describe, expect, it } from 'vitest'
import {
  AURA_COLORS, RING_COUNT, RING_LIFE, auraFlash, createAura, spawnRing, updateAura,
} from './components/PickleRick/animation/auraLayer'
import {
  flameFlicker,
  boltPoints,
  flameSilhouettePoints,
  mulberry32,
  writeBolt,
  buildSuperSaiyanSpires,
  writeSpireGeometry,
  createSpireIndex,
} from './components/PickleRick/FlameShape'
import { EXPRESSION_NAMES } from './components/PickleRick/ExpressionController'

const DT = 1 / 60

function settle(
  face: (typeof EXPRESSION_NAMES)[number] = 'idle',
  energy = 1, kick = 0, speed = 0, dragging = false, seconds = 5,
) {
  const a = createAura()
  for (let t = 0; t < seconds; t += DT) updateAura(a, face, energy, kick, speed, dragging, DT)
  return a
}

describe('aura colors', () => {
  it('covers every expression with valid channels', () => {
    for (const name of EXPRESSION_NAMES) {
      const c = AURA_COLORS[name]
      expect(c).toBeDefined()
      for (const v of [c.r, c.g, c.b]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  it('eases toward the displayed face color', () => {
    const a = settle('angry', 1, 0, 0, false, 8)
    expect(a.color.r).toBeCloseTo(AURA_COLORS.angry.r, 2)
    expect(a.color.g).toBeCloseTo(AURA_COLORS.angry.g, 2)
    expect(a.color.b).toBeCloseTo(AURA_COLORS.angry.b, 2)
  })
})

describe('glow', () => {
  it('rests faint, burns brighter when excited, held, hopping or flying', () => {
    expect(settle().glow).toBeGreaterThan(0.1)
    expect(settle().glow).toBeLessThan(0.4)
    expect(settle('excited', 2).glow).toBeGreaterThan(settle().glow + 0.15)
    expect(settle('idle', 1, 0, 0, true).glow).toBeGreaterThan(settle().glow + 0.15)
    expect(settle('idle', 1, 0.4).glow).toBeGreaterThan(settle().glow + 0.15)
    expect(settle('idle', 1, 0, 5).glow).toBeGreaterThan(settle().glow + 0.15)
  })

  it('never leaves 0..1, even for wild inputs', () => {
    const a = settle('excited', 9, 5, 50, true, 10)
    expect(a.glow).toBeLessThanOrEqual(1)
    const calm = settle('smug', 0.1, 0, 0, false, 10)
    expect(calm.glow).toBeGreaterThanOrEqual(0)
  })

  it('flashes decay back to nothing', () => {
    const a = createAura()
    auraFlash(a, 0.8)
    expect(a.flash).toBeCloseTo(0.8)
    auraFlash(a, 99) // capped: overlaps can't blow out
    expect(a.flash).toBe(1)
    for (let t = 0; t < 3; t += DT) updateAura(a, 'idle', 1, 0, 0, false, DT)
    expect(a.flash).toBeLessThan(0.01)
  })

  it('ignores non-positive dt', () => {
    const a = createAura()
    updateAura(a, 'excited', 2, 1, 9, true, 0)
    expect(a.glow).toBeLessThan(0.4)
    expect(Number.isFinite(a.glow)).toBe(true)
  })
})

describe('rings', () => {
  it('burst where told, expand, then retire', () => {
    const a = createAura()
    spawnRing(a, 1.5)
    expect(a.rings.filter((r) => r.active)).toHaveLength(1)
    expect(a.rings.find((r) => r.active)?.x).toBe(1.5)
    for (let t = 0; t < RING_LIFE + DT; t += DT) updateAura(a, 'idle', 1, 0, 0, false, DT)
    expect(a.rings.some((r) => r.active)).toBe(false)
  })

  it('reuses the pool instead of growing', () => {
    const a = createAura()
    for (let i = 0; i < RING_COUNT + 2; i++) spawnRing(a, i)
    expect(a.rings).toHaveLength(RING_COUNT)
    expect(a.rings.filter((r) => r.active)).toHaveLength(RING_COUNT)
    expect(a.rings.map((r) => r.x)).toContain(RING_COUNT + 1) // newest burst kept
  })
})

describe('flameSilhouettePoints', () => {
  it('climbs both edges to one tall tip inside the given box', () => {
    const halfW = 1.3
    const h = 4.0
    const pts = flameSilhouettePoints(halfW, h, 9)
    expect(pts).toHaveLength(2 * 9 + 3) // left edge + tip + right edge
    for (const [x, y] of pts) {
      expect(Math.abs(x)).toBeLessThanOrEqual(halfW + 1e-6)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(h * 1.03)
    }
    expect(pts[0][1]).toBe(0) // starts at the base...
    expect(pts[pts.length - 1][1]).toBe(0) // ...and returns to it
    const top = pts.reduce((a, b) => (b[1] > a[1] ? b : a))
    expect(top[1]).toBeCloseTo(h * 1.02) // one tip above everything else
  })
})

describe('boltPoints', () => {
  const ends = { from: [-0.1, -0.7] as [number, number], to: [0.15, 1.5] as [number, number] }

  it('pins the endpoints and jitters only the middle', () => {
    const pts = boltPoints(42, ends, 6, 0.12)
    expect(pts).toHaveLength(7)
    expect(pts[0]).toEqual([-0.1, -0.7])
    expect(pts[6]).toEqual([0.15, 1.5])
    for (const [x, y] of pts.slice(1, 6)) {
      expect(Math.abs(x - 0.025)).toBeLessThan(0.5) // near the straight line, never wild
      expect(y).toBeGreaterThan(-0.8)
      expect(y).toBeLessThan(1.6)
    }
  })

  it('is stable per seed and differs across seeds', () => {
    expect(boltPoints(7, ends, 6, 0.12)).toEqual(boltPoints(7, ends, 6, 0.12))
    expect(boltPoints(7, ends, 6, 0.12)).not.toEqual(boltPoints(8, ends, 6, 0.12))
    expect(mulberry32(3)()).toBe(mulberry32(3)())
  })
})

describe('writeBolt', () => {
  it('writes a centered strip of the right width', () => {
    const pts = boltPoints(11, { from: [0, 0], to: [0, 2] }, 4, 0)
    const buf = new Float32Array(5 * 2 * 3)
    writeBolt(buf, pts, 0.1)
    for (let i = 0; i < 5; i++) {
      const o = i * 6
      expect((buf[o] + buf[o + 3]) / 2).toBeCloseTo(pts[i][0]) // verts straddle the path
      expect((buf[o + 1] + buf[o + 4]) / 2).toBeCloseTo(pts[i][1])
      expect(Math.hypot(buf[o] - buf[o + 3], buf[o + 1] - buf[o + 4])).toBeCloseTo(0.1)
      expect(buf[o + 2]).toBe(0)
    }
  })
})

describe('flameFlicker', () => {
  it('stays in flame range and is deterministic', () => {
    for (let t = 0; t < 10; t += 0.07) {
      const f = flameFlicker(t, 1.3)
      expect(f).toBeGreaterThanOrEqual(-1.05)
      expect(f).toBeLessThanOrEqual(1.05)
      expect(flameFlicker(t, 1.3)).toBe(f) // same inputs, same flame
    }
  })

  it('staggers tongues so they never pulse together', () => {
    const at = (phase: number) => flameFlicker(2.0, phase)
    const seen = new Set([at(0), at(2.39), at(4.78)].map((f) => f.toFixed(3)))
    expect(seen.size).toBe(3)
  })

  it('averages near zero, so flames wobble around their base size', () => {
    let sum = 0
    const n = 400
    for (let i = 0; i < n; i++) sum += flameFlicker(i * 0.05, 0.7)
    expect(Math.abs(sum / n)).toBeLessThan(0.1)
  })
})

describe('SuperSaiyanSpires', () => {
  it('generates dense back and front spires with valid shapes', () => {
    const { back, front } = buildSuperSaiyanSpires()
    expect(back.length).toBeGreaterThan(40)
    expect(front.length).toBeGreaterThan(8)

    for (const s of [...back, ...front]) {
      expect(Number.isFinite(s.bx)).toBe(true)
      expect(Number.isFinite(s.by)).toBe(true)
      expect(Number.isFinite(s.tx)).toBe(true)
      expect(Number.isFinite(s.ty)).toBe(true)
      expect(s.w).toBeGreaterThan(0.1)
      expect(s.ty).toBeGreaterThan(s.by) // tips reach above bases
    }
  })

  it('creates valid spire indices', () => {
    const indices = createSpireIndex(10)
    expect(indices).toHaveLength(10 * 9) // 3 triangles = 9 indices per spire
    expect(Math.max(...indices)).toBe(10 * 5 - 1)
  })

  it('writes dynamic spire geometry and vertex colors', () => {
    const { back } = buildSuperSaiyanSpires()
    const pos = new Float32Array(back.length * 5 * 3)
    const col = new Float32Array(back.length * 5 * 3)
    writeSpireGeometry(pos, col, back, 1.5, 1.0, { r: 1, g: 0.88, b: 0.22 })

    for (let i = 0; i < pos.length; i++) {
      expect(Number.isFinite(pos[i])).toBe(true)
    }
    for (let i = 0; i < col.length; i++) {
      expect(col[i]).toBeGreaterThanOrEqual(0)
      expect(col[i]).toBeLessThanOrEqual(1.01)
    }
  })
})
