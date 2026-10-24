// Tests for the limb setup: sockets, rest pose and the limb animation layer. No browser needed.
import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { bendX, profileRadius, surfaceRadius } from './components/PickleRick/bodyShape'
import { EXPRESSIONS, EXPRESSION_NAMES } from './components/PickleRick/ExpressionController'
import { createIdle, updateIdle } from './components/PickleRick/animation/idleLayer'
import { createLimbs, updateLimbs } from './components/PickleRick/animation/limbLayer'
import {
  GROUND_Y, LIMB_IDS, LIMBS, REST_JOINTS, SEGMENTS, limbJointPositions, type JointPose, type LimbDef,
} from './components/PickleRick/limbs/limbConfig'

const DT = 1 / 60

/** True if a body-space point is inside the pickle body (with a small tolerance). */
function insideBody(p: Vector3, tolerance = 0): boolean {
  const r = profileRadius(p.y)
  if (r <= 0) return false
  return Math.hypot(p.x - bendX(p.y), p.z) < r - tolerance
}

/** Points along the limb, skipping the first part of the upper segment (it starts at the socket, on the skin). */
function limbSamples(def: LimbDef, j: JointPose): Vector3[] {
  const { root, middle, end } = limbJointPositions(def, j)
  const points: Vector3[] = []
  for (let t = 0.35; t <= 1; t += 0.05) points.push(root.clone().lerp(middle, t))
  for (let t = 0; t <= 1; t += 0.05) points.push(middle.clone().lerp(end, t))
  return points
}

describe('sockets', () => {
  it('have the expected names and sit on the body surface', () => {
    expect(LIMB_IDS.map((id) => LIMBS[id].socketName)).toEqual(['LeftArmSocket', 'RightArmSocket', 'LeftLegSocket', 'RightLegSocket'])
    expect(LIMB_IDS.map((id) => LIMBS[id].partName)).toEqual(['ArmLeft', 'ArmRight', 'LegLeft', 'LegRight'])
    for (const id of LIMB_IDS) {
      const [x, y, z] = LIMBS[id].socket.position
      const phi = Math.atan2(x - bendX(y), z)
      const fromAxis = Math.hypot(x - bendX(y), z)
      expect(Math.abs(fromAxis - surfaceRadius(y, phi))).toBeLessThan(0.06)
    }
  })

  it('left and right sockets mirror each other', () => {
    for (const [l, r] of [['leftArm', 'rightArm'], ['leftLeg', 'rightLeg']] as const) {
      const a = LIMBS[l].socket
      const b = LIMBS[r].socket
      expect(a.position[0]).toBeLessThan(0)
      expect(b.position[0]).toBeGreaterThan(0)
      expect(a.position[1]).toBeCloseTo(b.position[1])
      expect(a.rotation[2]).toBeCloseTo(-b.rotation[2])
    }
  })
})

describe('rest pose', () => {
  it('arms hang outward and legs stand below the body', () => {
    for (const id of LIMB_IDS) {
      const def = LIMBS[id]
      const { root, end } = limbJointPositions(def, REST_JOINTS[def.kind])
      expect(end.y).toBeLessThan(root.y) // hangs down
      if (def.kind === 'arm') expect(Math.sign(end.x)).toBe(def.side)
      else expect(end.y).toBeLessThan(-1.36) // feet below the bottom of the body
    }
  })

  it('no limb passes through the body', () => {
    for (const id of LIMB_IDS) {
      const def = LIMBS[id]
      for (const p of limbSamples(def, REST_JOINTS[def.kind])) expect(insideBody(p, SEGMENTS[def.kind].radius * 0.5)).toBe(false)
    }
  })

  it('the ground is just below the feet', () => {
    expect(GROUND_Y).toBeLessThan(-1.6)
    expect(GROUND_Y).toBeGreaterThan(-2.2)
  })
})

describe('limb layer', () => {
  /** Settles the limb layer on an expression for a few seconds of idle. */
  function settle(name: (typeof EXPRESSION_NAMES)[number], kick = 0, motion = 1) {
    const idle = createIdle()
    const limbs = createLimbs()
    for (let t = 0; t < 3; t += DT) {
      updateIdle(idle, t, DT, 1, motion)
      updateLimbs(limbs, idle, EXPRESSIONS[name], kick, DT, motion)
    }
    return limbs
  }

  it('starts in the rest pose', () => {
    const limbs = createLimbs()
    for (const id of LIMB_IDS) expect(limbs.joints[id]).toEqual(REST_JOINTS[LIMBS[id].kind])
  })

  it('excited throws the arms up, idle keeps them down', () => {
    const up = limbJointPositions(LIMBS.rightArm, settle('excited').joints.rightArm).end
    const down = limbJointPositions(LIMBS.rightArm, settle('idle').joints.rightArm).end
    expect(up.y).toBeGreaterThan(down.y + 0.4)
  })

  it('no expression pushes a limb into the body', () => {
    for (const name of EXPRESSION_NAMES) {
      const limbs = settle(name)
      for (const id of LIMB_IDS) {
        const def = LIMBS[id]
        for (const p of limbSamples(def, limbs.joints[id])) expect(insideBody(p, SEGMENTS[def.kind].radius * 0.5)).toBe(false)
      }
    }
  })

  it('a hop flails the arms and tucks the knees; reduced motion ignores it', () => {
    const calm = settle('idle', 0)
    const hop = settle('idle', 0.3)
    expect(hop.joints.leftArm.upperZ).toBeGreaterThan(calm.joints.leftArm.upperZ)
    expect(hop.joints.leftLeg.lowerX).toBeGreaterThan(calm.joints.leftLeg.lowerX)
    expect(settle('idle', 0.3, 0).joints.leftLeg).toEqual(REST_JOINTS.leg)
  })
})
