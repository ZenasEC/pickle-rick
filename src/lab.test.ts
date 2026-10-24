// Tests for the laboratory helpers. Plain numbers only, no browser needed.
import { describe, expect, it } from 'vitest'
import { bubbleHeight } from './scene/Laboratory'

describe('bubbleHeight', () => {
  it('stays inside the liquid column', () => {
    for (let t = 0; t < 20; t += 0.05) {
      const y = bubbleHeight(t, 0.18, 0.12, 0.24)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThan(0.24)
    }
  })

  it('rises steadily then wraps back to the bottom', () => {
    const a = bubbleHeight(0, 0.18, 0, 0.24)
    const b = bubbleHeight(0.5, 0.18, 0, 0.24)
    expect(b).toBeGreaterThan(a) // rising
    const many: number[] = []
    for (let t = 0; t < 10; t += 0.1) many.push(bubbleHeight(t, 0.18, 0, 0.24))
    expect(Math.max(...many)).toBeGreaterThan(0.2) // reaches near the top
    expect(Math.min(...many)).toBeLessThan(0.05) // and restarts at the bottom
  })

  it('offsets stagger the bubbles so they never line up', () => {
    const ys = [0, 0.12, 0.22].map((off) => bubbleHeight(1.0, 0.18, off, 0.24))
    expect(new Set(ys.map((y) => y.toFixed(3))).size).toBe(3)
  })
})
