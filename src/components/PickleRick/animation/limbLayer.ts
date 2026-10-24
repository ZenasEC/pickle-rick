// Limb layer: turns the other layers into joint angles for the arms and legs.
//   idle        arms sway a little, out of step with each other, and rise on the inhale
//   expression  armLift / armBend from the pose (arms up when excited, hands on hips when angry)
//   reaction    a lagged copy of the hop spring: arms flail up and knees tuck, trailing the body
import { MathUtils } from 'three'
import type { ExpressionPose } from '../ExpressionController'
import { LIMB_IDS, LIMBS, REST_JOINTS, type JointPose, type LimbId } from '../limbs/limbConfig'
import type { IdleState } from './idleLayer'

const FLAIL_FOLLOW = 7 // lower = limbs trail the body more
const ARM_LIFT = 1.5 // shoulder raise (radians) at armLift = 1
const ARM_FLAIL = 1.3 // shoulder raise per unit of hop
const ELBOW_BEND = 1.1 // extra elbow bend at armBend = 1
const ARM_SWAY = 0.07
const BREATH_LIFT = 2 // arms rise this much per unit of breath scale
const KNEE_TUCK = 0.9 // knee bend per unit of hop
const MIN_ARM_OUT = -0.25 // never swing the arms further in than this, so they don't sink into the body

export interface LimbLayerState {
  /** Output: joint angles per limb (see JointPose for the sign convention). */
  joints: Record<LimbId, JointPose>
  /** Internal: the hop, delayed. */
  flail: number
}

export function createLimbs(): LimbLayerState {
  const joints = {} as Record<LimbId, JointPose>
  for (const id of LIMB_IDS) joints[id] = { ...REST_JOINTS[LIMBS[id].kind] }
  return { joints, flail: 0 }
}

/** kick: the reaction spring (>0 = hopping). motion: 0 for reduced motion. */
export function updateLimbs(
  s: LimbLayerState, idle: IdleState, pose: ExpressionPose, kick: number, dt: number, motion: number,
): void {
  s.flail = MathUtils.damp(s.flail, kick * motion, FLAIL_FOLLOW, dt)
  const up = Math.max(s.flail, 0)

  for (const id of LIMB_IDS) {
    const def = LIMBS[id]
    const rest = REST_JOINTS[def.kind]
    const j = s.joints[id]
    if (def.kind === 'arm') {
      // Each arm on its own phase, so they never move like a mirror image.
      const sway = motion * ARM_SWAY * Math.sin(idle.phase.sway * 1.4 + (def.side > 0 ? 1.7 : 0))
      const out = pose.armLift * ARM_LIFT + up * ARM_FLAIL + idle.breath * BREATH_LIFT + sway
      j.upperX = rest.upperX - pose.armLift * 0.25
      j.upperZ = rest.upperZ + Math.max(out, MIN_ARM_OUT)
      j.lowerX = rest.lowerX - pose.armBend * 0.35
      j.lowerZ = rest.lowerZ - pose.armBend * ELBOW_BEND
    } else {
      j.upperX = rest.upperX - up * KNEE_TUCK * 0.5
      j.upperZ = rest.upperZ
      j.lowerX = rest.lowerX + up * KNEE_TUCK
      j.lowerZ = rest.lowerZ
    }
  }
}
