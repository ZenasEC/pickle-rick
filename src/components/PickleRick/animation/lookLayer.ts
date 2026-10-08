// Layer 2, look direction: the head/body turns a little toward the cursor, after the eyes.
// This is separate from eye tracking (useEyeTracking), which still aims the pupils.
import { MathUtils } from 'three'
import type { PointerState } from '../../../hooks/useMousePosition'

const MAX_YAW = 0.22 // turn toward the cursor's side
const MAX_PITCH = 0.09 // look up / down
const MAX_ROLL = 0.05 // lean toward the cursor's side
const LEAN_IN = 0.07 // lean toward the viewer when the cursor is close
const FOLLOW_SPEED = 3.5 // slower than the pupils (10), so the eyes lead and the head follows

export interface LookState {
  yaw: number
  pitch: number
  roll: number
}

export const createLook = (): LookState => ({ yaw: 0, pitch: 0, roll: 0 })

/** proximity: 0 = cursor far from the character, 1 = on top of it. motion: 0 for reduced motion. */
export function updateLook(s: LookState, pointer: PointerState, proximity: number, dt: number, motion: number): void {
  const x = pointer.active ? pointer.x : 0
  const y = pointer.active ? pointer.y : 0
  // rotation.y > 0 turns the face to the right; rotation.x > 0 tips the top toward the viewer; rotation.z < 0 leans right.
  s.yaw = MathUtils.damp(s.yaw, motion * x * MAX_YAW, FOLLOW_SPEED, dt)
  s.pitch = MathUtils.damp(s.pitch, motion * (-y * MAX_PITCH + proximity * LEAN_IN), FOLLOW_SPEED, dt)
  s.roll = MathUtils.damp(s.roll, motion * -x * MAX_ROLL, FOLLOW_SPEED, dt)
}
