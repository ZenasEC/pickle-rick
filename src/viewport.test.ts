// Tests for responsive framing. Plain numbers only, no browser needed.
import { describe, expect, it } from 'vitest'
import { BASE_DISTANCE, dragBoundX, fitDistance } from './scene/viewport'
import { createDrag, moveDrag, startDrag } from './components/PickleRick/animation/dragLayer'
import { DRAG_BOUNDS_X } from './components/PickleRick/animation/dragLayer'

describe('fitDistance', () => {
  it('leaves common desktop aspects exactly alone', () => {
    for (const aspect of [16 / 9, 16 / 10, 4 / 3, 1]) {
      expect(fitDistance(aspect)).toBe(BASE_DISTANCE)
    }
  })

  it('dollies out as screens get narrower', () => {
    expect(fitDistance(0.5)).toBeGreaterThan(fitDistance(0.75))
    expect(fitDistance(0.75)).toBeGreaterThanOrEqual(BASE_DISTANCE)
    expect(fitDistance(0.5)).toBeLessThan(12) // still close enough to read the face
  })

  it('falls back to base for nonsense input', () => {
    for (const aspect of [0, -1, NaN, Infinity]) {
      expect(fitDistance(aspect)).toBe(BASE_DISTANCE)
    }
  })
})

describe('dragBoundX', () => {
  it('is the full range on desktop', () => {
    expect(dragBoundX(BASE_DISTANCE, 16 / 9)).toBe(DRAG_BOUNDS_X)
  })

  it('shrinks on narrow screens but never below the minimum', () => {
    const phone = dragBoundX(fitDistance(0.5), 0.5)
    expect(phone).toBeLessThan(DRAG_BOUNDS_X)
    expect(phone).toBeGreaterThanOrEqual(1.0)
    expect(dragBoundX(BASE_DISTANCE, 0.3)).toBe(1.0) // extreme: clamped to the floor
  })

  it('falls back to full range for nonsense input', () => {
    expect(dragBoundX(0, 1)).toBe(DRAG_BOUNDS_X)
    expect(dragBoundX(7.4, NaN)).toBe(DRAG_BOUNDS_X)
  })
})

describe('moveDrag with a custom bound', () => {
  it('clamps to the passed bound instead of the default', () => {
    const s = createDrag()
    startDrag(s, 0, 0)
    moveDrag(s, 99, 0, 1.0)
    expect(s.targetX).toBe(1.0)
    moveDrag(s, 99, 0) // default again
    expect(s.targetX).toBe(DRAG_BOUNDS_X)
  })
})
