// Tests for drag and drop physics. Plain numbers only, no browser needed.
import { describe, expect, it } from 'vitest'
import {
  createDrag, startDrag, moveDrag, endDrag, updateDrag,
  DRAG_BOUNDS_X, DRAG_MAX_Y,
} from './components/PickleRick/animation/dragLayer'

const DT = 1 / 60

function settle(s: ReturnType<typeof createDrag>, seconds: number, motion = 1) {
  for (let t = 0; t < seconds; t += DT) updateDrag(s, DT, motion)
}

describe('drag', () => {
  it('stays put on grab (no jump to the cursor), then follows the pointer', () => {
    const s = createDrag()
    s.x = 0.5
    startDrag(s, 2, 1)
    expect(s.dragging).toBe(true)
    expect(s.targetX).toBeCloseTo(0.5) // grab offset remembered
    for (let i = 0; i < 120; i++) updateDrag(s, DT, 1)
    expect(s.x).toBeCloseTo(0.5, 1) // no target move yet: holds still
    moveDrag(s, 3, 2)
    settle(s, 1)
    expect(s.x).toBeGreaterThan(1) // carried toward the pointer minus the offset
    expect(s.squash).toBeGreaterThan(0) // slight stretch while carried
  })

  it('clamps the target so it cannot leave the screen or go through the floor', () => {
    const s = createDrag()
    startDrag(s, 0, 0)
    moveDrag(s, 99, 99)
    expect(s.targetX).toBeLessThanOrEqual(DRAG_BOUNDS_X)
    expect(s.targetY).toBeLessThanOrEqual(DRAG_MAX_Y)
    moveDrag(s, 0, -99)
    expect(s.targetY).toBeGreaterThanOrEqual(0)
    moveDrag(s, 1, 1) // ignored once released
    endDrag(s)
    moveDrag(s, 1, 1)
    expect(s.targetX).toBeLessThanOrEqual(DRAG_BOUNDS_X)
  })

  it('falls, bounces with a squash, then settles back home', () => {
    const s = createDrag()
    startDrag(s, 0, 0)
    moveDrag(s, 0.5, 2.5)
    settle(s, 0.8) // carried up
    expect(s.y).toBeGreaterThan(1)
    endDrag(s)
    let minSquash = 0
    let bounced = false
    let prevY = s.y
    for (let i = 0; i < 600; i++) {
      updateDrag(s, DT, 1)
      minSquash = Math.min(minSquash, s.squash)
      if (prevY > 0.05 && s.y === 0) bounced = true // touched down
      prevY = s.y
      if (bounced && s.y > 0.02) break // left the ground again: a real bounce
    }
    expect(bounced).toBe(true)
    expect(minSquash).toBeLessThan(-0.02) // landing squashes wide
    settle(s, 6)
    expect(s.y).toBe(0)
    expect(s.x).toBeCloseTo(0, 1) // homing spring pulled it back to center
    expect(Math.abs(s.squash)).toBeLessThan(0.01)
  })

  it('a throw keeps horizontal speed and leans into it', () => {
    const s = createDrag()
    startDrag(s, 0, 0)
    // Flick right fast for a few frames, like a hand fling.
    for (let i = 0; i < 20; i++) {
      moveDrag(s, i * 0.1, 1)
      updateDrag(s, DT, 1)
    }
    endDrag(s)
    expect(s.vx).toBeGreaterThan(0.5)
    const xAtRelease = s.x
    for (let i = 0; i < 30; i++) updateDrag(s, DT, 1)
    expect(s.x).toBeGreaterThan(xAtRelease) // still travelling right
    expect(Math.abs(s.tilt)).toBeGreaterThan(0.005)
    expect(Math.abs(s.tilt)).toBeLessThanOrEqual(0.36)
  })

  it('reduced motion never throws or bounces', () => {
    const s = createDrag()
    startDrag(s, 0, 0)
    moveDrag(s, 2, 2.5)
    settle(s, 1, 0)
    endDrag(s)
    settle(s, 3, 0)
    expect(s.y).toBeCloseTo(0, 1)
    expect(s.squash).toBeCloseTo(0, 2)
    expect(s.vx).toBe(0)
    expect(s.vy).toBe(0)
  })

  it('survives long frames without exploding', () => {
    const s = createDrag()
    startDrag(s, 0, 0)
    moveDrag(s, -2, 2.5)
    updateDrag(s, 0.1, 1)
    endDrag(s)
    for (let i = 0; i < 200; i++) updateDrag(s, 0.1, 1)
    expect(Number.isFinite(s.x)).toBe(true)
    expect(Number.isFinite(s.y)).toBe(true)
    expect(Number.isFinite(s.squash)).toBe(true)
    expect(s.y).toBeGreaterThanOrEqual(0)
  })
})
