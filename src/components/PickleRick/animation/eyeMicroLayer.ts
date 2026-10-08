// Small eye micro-movements: quick tiny jumps (microsaccades), a faint continuous drift and a
// slight pupil-size wobble. useEyeTracking adds yaw/pitch to the pupil aim, so they still
// follow the cursor, just never perfectly still.
import { MathUtils } from 'three'

const MAX_YAW = 0.09 // radians
const MAX_PITCH = 0.06
const JUMP_SPEED = 28 // high: the eye "jumps" to each new spot, then rests
const RECENTER_CHANCE = 0.3
const MIN_REST = 0.3 // seconds between jumps
const REST_SPREAD = 1.4

export interface EyeMicroState {
  /** Outputs: added to the pupil aim (radians) and to the pupil scale (fraction). */
  yaw: number
  pitch: number
  pupil: number
  // Internal. jump* is the eased jump alone; the output adds the drift on top, so drift never feeds back into the easing.
  targetYaw: number
  targetPitch: number
  jumpYaw: number
  jumpPitch: number
  nextAt: number
}

export const createEyeMicro = (): EyeMicroState => ({
  yaw: 0, pitch: 0, pupil: 0, targetYaw: 0, targetPitch: 0, jumpYaw: 0, jumpPitch: 0, nextAt: 0.5,
})

/** amount: 1 = full size, smaller when the eyes are busy following the cursor. */
export function updateEyeMicro(s: EyeMicroState, t: number, dt: number, amount: number): void {
  if (t >= s.nextAt) {
    const recenter = Math.random() < RECENTER_CHANCE
    s.targetYaw = recenter ? 0 : MathUtils.randFloatSpread(2 * MAX_YAW)
    s.targetPitch = recenter ? 0 : MathUtils.randFloatSpread(2 * MAX_PITCH)
    s.nextAt = t + MIN_REST + Math.random() * REST_SPREAD
  }
  const driftYaw = 0.006 * Math.sin(t * 1.9) + 0.004 * Math.sin(t * 3.3 + 1.2)
  const driftPitch = 0.004 * Math.sin(t * 2.3 + 0.5) + 0.003 * Math.sin(t * 4.1)
  s.jumpYaw = MathUtils.damp(s.jumpYaw, s.targetYaw * amount, JUMP_SPEED, dt)
  s.jumpPitch = MathUtils.damp(s.jumpPitch, s.targetPitch * amount, JUMP_SPEED, dt)
  s.yaw = s.jumpYaw + driftYaw * amount
  s.pitch = s.jumpPitch + driftPitch * amount
  s.pupil = amount * (0.03 * Math.sin(t * 1.3) + 0.015 * Math.sin(t * 3.1 + 0.7))
}
