// Cursor analysis shared by the layers: how fast it moves, how close it is to the character,
// and whether it just (re)entered the window. All distances are in NDC units where the
// screen height is 2, with x scaled by the aspect ratio so distances are the same in every direction.
import { MathUtils } from 'three'
import type { PointerState } from '../../../hooks/useMousePosition'

const SPEED_SMOOTHING = 14 // ~70 ms: ignores single-pixel jitter but catches a flick
const PROXIMITY_SMOOTHING = 4
const ZONE_ENTER = 0.9 // "near the character"; enter and exit differ so it doesn't flicker at the edge
const ZONE_EXIT = 1.1
const PROXIMITY_NEAR = 0.3 // proximity is 1 at this distance...
const PROXIMITY_FAR = 1.5 // ...and 0 at this one
const RETURN_AFTER = 1.5 // seconds away before coming back counts as an arrival

export interface CursorState {
  /** Smoothed cursor speed, NDC units per second. */
  speed: number
  /** Distance from the character's center. Only meaningful while the cursor is in the window. */
  distance: number
  /** 0 = far, 1 = right on the character (smoothed). */
  proximity: number
  /** Within the "near" zone. */
  inZone: boolean
  /** True for exactly one frame when the cursor (re)enters the window. */
  arrived: boolean
  // Internal
  active: boolean
  seen: boolean
  prevX: number
  prevY: number
  awaySince: number
}

export const createCursor = (): CursorState => ({
  speed: 0, distance: 99, proximity: 0, inZone: false, arrived: false,
  active: false, seen: false, prevX: 0, prevY: 0, awaySince: 0,
})

/** (cx, cy): the character's center in NDC. delta: real frame time, used for speed. */
export function updateCursor(
  c: CursorState, p: PointerState, cx: number, cy: number, aspect: number, t: number, delta: number,
): void {
  const dt = Math.min(delta, 0.1)
  c.arrived = false

  if (!p.active) {
    if (c.active) {
      c.active = false
      c.awaySince = t
    }
    c.speed = MathUtils.damp(c.speed, 0, SPEED_SMOOTHING, dt)
    c.proximity = MathUtils.damp(c.proximity, 0, PROXIMITY_SMOOTHING, dt)
    c.inZone = false
    return
  }

  const x = p.x * aspect
  const y = p.y
  if (!c.active) {
    // First sample after entering: no previous position, so no speed spike.
    c.active = true
    c.arrived = !c.seen || t - c.awaySince > RETURN_AFTER
    c.seen = true
  } else if (delta <= 0.25) {
    // A long frame (tab switch) would turn a normal move into a fake flick, so skip it.
    const raw = Math.hypot(x - c.prevX, y - c.prevY) / Math.max(delta, 1 / 240)
    c.speed = MathUtils.damp(c.speed, raw, SPEED_SMOOTHING, dt)
  }
  c.prevX = x
  c.prevY = y

  c.distance = Math.hypot(x - cx * aspect, y - cy)
  c.inZone = c.inZone ? c.distance < ZONE_EXIT : c.distance < ZONE_ENTER
  const near = 1 - MathUtils.smoothstep(c.distance, PROXIMITY_NEAR, PROXIMITY_FAR)
  c.proximity = MathUtils.damp(c.proximity, near, PROXIMITY_SMOOTHING, dt)
}
