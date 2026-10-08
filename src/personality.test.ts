// Tests for the personality layers. They are plain functions of (state, time), so they run
// without a browser: each test simulates the cursor / clock frame by frame.
import { describe, expect, it, vi } from 'vitest'
import { EXPRESSIONS, EXPRESSION_NAMES, EXPRESSION_SPEED, clonePose, dampPose, updateExpression } from './components/PickleRick/ExpressionController'
import { createBlink, updateBlink } from './components/PickleRick/animation/blinkLayer'
import { createCursor, updateCursor } from './components/PickleRick/animation/cursorLayer'
import { createEyeMicro, updateEyeMicro } from './components/PickleRick/animation/eyeMicroLayer'
import { createIdle, updateIdle } from './components/PickleRick/animation/idleLayer'
import { createLook, updateLook } from './components/PickleRick/animation/lookLayer'
import { createReactions, updateReactions } from './components/PickleRick/animation/reactionLayer'
import type { PointerState } from './hooks/useMousePosition'

const DT = 1 / 60

/** Collects every number in an object, with its path, so shapes can be compared. */
function leaves(obj: object, path = ''): Record<string, number> {
  return Object.entries(obj).reduce<Record<string, number>>((out, [k, v]) => {
    if (typeof v === 'number') out[path + k] = v
    else Object.assign(out, leaves(v, `${path}${k}.`))
    return out
  }, {})
}

/** A little world: a pointer, a cursor tracker and the reactions, advanced frame by frame. */
function createWorld() {
  const pointer: PointerState = { x: 0, y: 0, active: false }
  const cursor = createCursor()
  const reaction = createReactions()
  let t = 0
  return {
    pointer, cursor, reaction,
    get t() { return t },
    /** Advance `seconds`, optionally moving the pointer by (vx, vy) NDC units per second each frame. */
    run(seconds: number, vx = 0, vy = 0) {
      for (let i = 0; i < Math.round(seconds / DT); i++) {
        t += DT
        pointer.x += vx * DT
        pointer.y += vy * DT
        updateCursor(cursor, pointer, 0, 0, 1, t, DT)
        updateReactions(reaction, cursor, t, DT)
      }
    },
  }
}

describe('expressions', () => {
  it('every expression has the same fields and a speed', () => {
    const idleShape = Object.keys(leaves(EXPRESSIONS.idle)).sort()
    for (const name of EXPRESSION_NAMES) {
      expect(Object.keys(leaves(EXPRESSIONS[name])).sort()).toEqual(idleShape)
      expect(EXPRESSION_SPEED[name]).toBeGreaterThan(0)
    }
  })

  it('dampPose eases every field, so a new field cannot be forgotten', () => {
    for (const name of EXPRESSION_NAMES) {
      const pose = clonePose(EXPRESSIONS.idle)
      for (let i = 0; i < 600; i++) updateExpression(pose, name, DT)
      const got = leaves(pose)
      for (const [key, want] of Object.entries(leaves(EXPRESSIONS[name]))) expect(got[key]).toBeCloseTo(want, 3)
    }
  })

  it('dampPose does not touch the target table', () => {
    const before = JSON.stringify(EXPRESSIONS)
    dampPose(clonePose(EXPRESSIONS.idle), EXPRESSIONS.angry, 6, 0.1)
    expect(JSON.stringify(EXPRESSIONS)).toBe(before)
  })
})

describe('cursor', () => {
  it('reports arrival once, speed from movement, and ignores a quick re-entry', () => {
    const w = createWorld()
    w.run(1)
    expect(w.cursor.arrived).toBe(false)
    w.pointer.active = true
    w.run(DT)
    expect(w.cursor.arrived).toBe(true)
    w.run(DT)
    expect(w.cursor.arrived).toBe(false)

    w.run(1, 3, 0) // sweep at 3 units/s
    expect(w.cursor.speed).toBeGreaterThan(2)

    w.pointer.active = false
    w.run(0.5)
    w.pointer.active = true
    w.run(DT)
    expect(w.cursor.arrived).toBe(false) // gone for 0.5 s: not a return
    w.pointer.active = false
    w.run(2)
    w.pointer.active = true
    w.run(DT)
    expect(w.cursor.arrived).toBe(true)
  })
})

describe('reactions', () => {
  it('a fast flick startles: surprised face, upward kick, blink request', () => {
    const w = createWorld()
    w.pointer.active = true
    w.pointer.x = -1.5
    w.run(0.3)
    const blinks: boolean[] = []
    let peak = 0
    for (let i = 0; i < 20; i++) {
      w.run(DT, 12, 0)
      blinks.push(w.reaction.blinkRequest)
      peak = Math.max(peak, w.reaction.kick)
    }
    expect(w.reaction.override).toBe('surprised')
    expect(blinks).toContain(true)
    for (let i = 0; i < 30; i++) {
      w.run(DT)
      peak = Math.max(peak, w.reaction.kick)
    }
    expect(peak).toBeGreaterThan(0.1)
    expect(peak).toBeLessThan(0.5)
  })

  it('goes back to the base expression and the spring settles', () => {
    const w = createWorld()
    w.pointer.active = true
    w.pointer.x = -1.5
    w.run(0.3)
    w.run(0.3, 12, 0)
    w.pointer.x = 3 // park the cursor far away
    w.run(6)
    expect(w.reaction.override).toBeNull()
    expect(Math.abs(w.reaction.kick)).toBeLessThan(0.001)
  })

  it('repeated flicks make it angry, and angry outranks surprised', () => {
    const w = createWorld()
    w.pointer.active = true
    w.pointer.x = -2
    w.run(0.2)
    for (let i = 0; i < 4; i++) {
      w.pointer.x = -2
      w.run(0.25, 14, 0)
      w.run(0.5)
    }
    expect(w.reaction.override).toBe('angry')
  })

  it('a cursor nearby is curious, resting there becomes smug, moving again goes back to curious', () => {
    const w = createWorld()
    w.pointer.active = true
    w.pointer.x = 0.3
    w.pointer.y = 0.2
    w.run(0.3)
    w.run(2) // the arrival's excited hold (1.6 s) outranks curious, so wait it out
    expect(w.reaction.override).toBe('curious')
    w.run(3)
    expect(w.reaction.override).toBe('smug')
    w.run(0.4, 1, 0) // slow drift, still near
    expect(w.reaction.override).toBe('curious')
  })

  it('arriving gets an excited reaction with two hops', () => {
    const w = createWorld()
    w.pointer.x = 2.5 // far from the character: no curiosity
    w.pointer.active = true
    w.run(DT)
    expect(w.reaction.override).toBe('excited')
    let peak = 0
    for (let i = 0; i < 60; i++) {
      w.run(DT)
      peak = Math.max(peak, w.reaction.kick)
    }
    expect(peak).toBeGreaterThan(0.1)
  })

  it('nothing happens while the cursor is outside the window', () => {
    const w = createWorld()
    w.run(10)
    expect(w.reaction.override).toBeNull()
    expect(w.reaction.kick).toBe(0)
  })
})

describe('blink', () => {
  it('closes fast, opens slower, reaches nearly shut and fully open', () => {
    const b = createBlink()
    updateBlink(b, 0, true, 1)
    let min = 1
    let closedFor = 0
    let t = 0
    for (; t < 0.5; t += 0.005) {
      updateBlink(b, t, false, 1)
      min = Math.min(min, b.openness)
      if (b.openness < 0.9) closedFor += 0.005
    }
    expect(min).toBeLessThan(0.1)
    expect(closedFor).toBeGreaterThan(0.1)
    expect(closedFor).toBeLessThan(0.3)
    expect(b.openness).toBe(1)
  })

  it('blinks every few seconds, with some doubles', () => {
    const b = createBlink()
    let blinks = 0
    let was = 1
    for (let t = 0; t < 300; t += DT) {
      updateBlink(b, t, false, 1)
      if (was >= 0.5 && b.openness < 0.5) blinks += 1
      was = b.openness
    }
    expect(blinks).toBeGreaterThan(300 / 6)
    expect(blinks).toBeLessThan(300 / 2)
  })

  it('blinks less often when the rate is lower', () => {
    const count = (rate: number) => {
      const b = createBlink()
      let n = 0
      let was = 1
      for (let t = 0; t < 600; t += DT) {
        updateBlink(b, t, false, rate)
        if (was >= 0.5 && b.openness < 0.5) n += 1
        was = b.openness
      }
      return n
    }
    expect(count(0.3)).toBeLessThan(count(1.5))
  })

  it('ignores a request right after a blink', () => {
    const b = createBlink()
    let t = 0
    updateBlink(b, t, true, 1)
    for (t = 0; t < 0.3; t += 0.005) updateBlink(b, t, false, 1)
    const nextAt = b.nextAt
    updateBlink(b, t, true, 1)
    expect(b.phase).toBe('open')
    expect(b.nextAt).toBe(nextAt)
  })
})

describe('idle', () => {
  it('stays small and bounded', () => {
    const s = createIdle()
    for (let t = 0; t < 120; t += DT) {
      updateIdle(s, t, DT, 1, 1)
      expect(Math.abs(s.breath)).toBeLessThan(0.02)
      expect(Math.abs(s.sway)).toBeLessThan(0.11)
      expect(Math.abs(s.bob)).toBeLessThan(0.04)
      expect(Math.abs(s.turn)).toBeLessThan(0.05)
      expect(Math.abs(s.nod)).toBeLessThan(0.025)
    }
  })

  it('is completely still for reduced motion', () => {
    const s = createIdle()
    for (let t = 0; t < 30; t += DT) {
      updateIdle(s, t, DT, 2, 0)
      expect([s.breath, s.sway, s.bob, s.turn, s.nod].every((v) => v === 0)).toBe(true) // === treats -0 as 0
    }
  })

  it('moves faster and bigger with more energy', () => {
    const range = (energy: number) => {
      const s = createIdle()
      let max = 0
      for (let t = 0; t < 20; t += DT) {
        updateIdle(s, t, DT, energy, 1)
        max = Math.max(max, Math.abs(s.bob))
      }
      return max
    }
    expect(range(2)).toBeGreaterThan(range(0.7))
  })

  it('fidgets now and then', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    const s = createIdle()
    let fidgeted = false
    for (let t = 0; t < 8; t += DT) {
      updateIdle(s, t, DT, 1, 1)
      if (s.fidgetStart >= 0) fidgeted = true
    }
    vi.restoreAllMocks()
    expect(fidgeted).toBe(true)
  })
})

describe('look', () => {
  it('turns toward the cursor, leans in when it is near, and relaxes when it leaves', () => {
    const s = createLook()
    const pointer: PointerState = { x: 1, y: 0.5, active: true }
    for (let i = 0; i < 300; i++) updateLook(s, pointer, 0, DT, 1)
    expect(s.yaw).toBeGreaterThan(0.1) // face turns right
    expect(s.roll).toBeLessThan(0) // leans right
    expect(s.pitch).toBeLessThan(0) // cursor above: looks up
    const pitchFar = s.pitch
    for (let i = 0; i < 300; i++) updateLook(s, pointer, 1, DT, 1)
    expect(s.pitch).toBeGreaterThan(pitchFar) // leaning toward the viewer
    pointer.active = false
    for (let i = 0; i < 600; i++) updateLook(s, pointer, 0, DT, 1)
    expect(Math.abs(s.yaw)).toBeLessThan(0.001)
  })

  it('does nothing for reduced motion', () => {
    const s = createLook()
    for (let i = 0; i < 300; i++) updateLook(s, { x: 1, y: 1, active: true }, 1, DT, 0)
    expect([s.yaw, s.pitch, s.roll]).toEqual([0, 0, 0])
  })
})

describe('eye micro-movements', () => {
  it('stay tiny but are not still', () => {
    const s = createEyeMicro()
    let moved = 0
    let last = 0
    for (let t = 0; t < 60; t += DT) {
      updateEyeMicro(s, t, DT, 1)
      expect(Math.abs(s.yaw)).toBeLessThan(0.11)
      expect(Math.abs(s.pitch)).toBeLessThan(0.075)
      expect(Math.abs(s.pupil)).toBeLessThan(0.05)
      moved += Math.abs(s.yaw - last)
      last = s.yaw
    }
    expect(moved).toBeGreaterThan(0.3)
  })

  it('shrink with the amount', () => {
    const peak = (amount: number) => {
      const s = createEyeMicro()
      let max = 0
      for (let t = 0; t < 60; t += DT) {
        updateEyeMicro(s, t, DT, amount)
        max = Math.max(max, Math.abs(s.yaw))
      }
      return max
    }
    expect(peak(0.5)).toBeLessThan(peak(1))
  })
})
