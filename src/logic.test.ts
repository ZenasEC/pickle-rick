// Tests for the pure math: no browser or WebGL needed. Run with `npm test`.
import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { computePupilAngles, MAX_PUPIL_ANGLE } from './hooks/useEyeTracking'
import { EXPRESSIONS, clonePose, dampPose, type ExpressionName } from './components/PickleRick/ExpressionController'

describe('computePupilAngles', () => {
  const out = { yaw: 0, pitch: 0 }

  it('looks straight ahead for a target directly in front', () => {
    computePupilAngles(new Vector3(0, 0, 3), MAX_PUPIL_ANGLE, out)
    expect(out.yaw).toBeCloseTo(0)
    expect(out.pitch).toBeCloseTo(0)
  })

  it('never exceeds the clamp, even for extreme or behind-the-eye targets', () => {
    for (const t of [[100, 0, 0.1], [-100, 100, 0.1], [0, -100, 0.1], [5, 5, -5]]) {
      computePupilAngles(new Vector3(...(t as [number, number, number])), MAX_PUPIL_ANGLE, out)
      expect(Math.abs(out.yaw)).toBeLessThanOrEqual(MAX_PUPIL_ANGLE)
      expect(Math.abs(out.pitch)).toBeLessThanOrEqual(MAX_PUPIL_ANGLE)
    }
  })

  it('turns right/up for a target right/up', () => {
    computePupilAngles(new Vector3(1, 1, 3), MAX_PUPIL_ANGLE, out)
    expect(out.yaw).toBeGreaterThan(0)
    expect(out.pitch).toBeGreaterThan(0)
  })
})

describe('expressions', () => {
  it('defines every expression name', () => {
    const names: ExpressionName[] = ['idle', 'curious', 'surprised']
    for (const n of names) expect(EXPRESSIONS[n]).toBeDefined()
  })

  it('dampPose eases toward the target without touching the table', () => {
    const pose = clonePose(EXPRESSIONS.idle)
    dampPose(pose, EXPRESSIONS.surprised, 6, 0.1)
    expect(pose.mouthOpen).toBeGreaterThan(EXPRESSIONS.idle.mouthOpen)
    expect(pose.mouthOpen).toBeLessThan(EXPRESSIONS.surprised.mouthOpen)
    expect(EXPRESSIONS.idle.mouthOpen).toBe(0.6)
    for (let i = 0; i < 200; i++) dampPose(pose, EXPRESSIONS.surprised, 6, 0.1)
    expect(pose.mouthOpen).toBeCloseTo(EXPRESSIONS.surprised.mouthOpen)
    expect(pose.browLeft.y).toBeCloseTo(EXPRESSIONS.surprised.browLeft.y)
    expect(pose.pupilScale).toBeCloseTo(EXPRESSIONS.surprised.pupilScale)
  })
})
