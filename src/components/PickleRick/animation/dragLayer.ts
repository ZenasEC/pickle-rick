// Drag and drop + cartoon physics. The pickle can be grabbed, carried and thrown:
//   dragging  position eases toward the pointer (a little behind, so it feels held, not glued)
//   released  velocity is kept, gravity pulls it down, it bounces on the ground with a squash,
//             then a weak spring pulls it back to the center.
// Everything here is plain numbers, so it runs in unit tests with no browser or WebGL.
import { MathUtils } from 'three'

// --- Tunables (world units, radians, seconds) ---
export const DRAG_FOLLOW = 14 // higher = tighter grip while held
export const DRAG_BOUNDS_X = 2.6 // pointer target is clamped to ±x so it stays on screen
export const DRAG_MIN_Y = 0 // never pushed through the floor (rest height)
export const DRAG_MAX_Y = 2.6
const HELD_STRETCH = 0.12 // slight elongation while carried, like being lifted by the scruff
const MAX_THROW_SPEED = 8 // release velocity clamp, so a wild flick can't launch it off screen
const GRAVITY = 7 // cartoon gravity: floatier than 9.8
const BOUNCE = 0.42 // keeps 42% of the fall speed on each bounce
const BOUNCE_MIN = 0.8 // slower than this: land softly instead of bouncing
const GROUND_FRICTION = 0.72 // horizontal speed kept per bounce
const AIR_DRAG = 0.12 // slight air resistance while flying
const HOME_STIFFNESS = 3.0 // weak spring pulling x back to center after a throw
const HOME_DAMPING = 2.6
const SQUASH_STIFFNESS = 180
const SQUASH_DAMPING = 11
const SQUASH_ON_LAND = 0.09 // squash impulse per unit of impact speed
const MAX_SQUASH = 0.45
const TILT_FOLLOW = 6 // lower = lean lags behind, like a hanging toy
const TILT_PER_VELOCITY = 0.06 // lean angle per unit of horizontal speed
const MAX_TILT = 0.35
const VELOCITY_SMOOTHING = 8 // smooths the throw velocity so one jittery frame can't spike it
const REST_VELOCITY = 0.05 // below this on the ground: sleep, snap home

export interface DragState {
  /** True between pointer-down on the character and pointer-up anywhere. */
  dragging: boolean
  /** Where the pointer wants the character (world XY on the z=0 plane), clamped to bounds. */
  targetX: number
  targetY: number
  /** Physics position offset from home (0, 0 = resting on the ground). */
  x: number
  y: number
  /** Velocity, kept on release so it can be thrown. */
  vx: number
  vy: number
  /** Squash spring: >0 stretched tall, <0 squashed wide. Applied to the torso scale. */
  squash: number
  /** Lean into horizontal motion (radians around Z). */
  tilt: number
  // Internal
  prevX: number
  prevY: number
  /** Grab offset: pointer world minus position, so the body doesn't jump to the cursor. */
  offX: number
  offY: number
  squashVel: number
}

export const createDrag = (): DragState => ({
  dragging: false,
  targetX: 0, targetY: 0,
  x: 0, y: 0, vx: 0, vy: 0,
  squash: 0, tilt: 0,
  prevX: 0, prevY: 0, offX: 0, offY: 0, squashVel: 0,
})

const clampTarget = (v: number, lo: number, hi: number) => MathUtils.clamp(v, lo, hi)

/** Grab: remember where on the body it was caught, stay put until the pointer moves. */
export function startDrag(s: DragState, worldX: number, worldY: number): void {
  s.dragging = true
  s.offX = worldX - s.x
  s.offY = worldY - s.y
  s.targetX = s.x
  s.targetY = s.y
  s.vx = 0
  s.vy = 0
  s.prevX = s.x
  s.prevY = s.y
}

/** Pointer moved while held: retarget, keeping the original grab offset. */
export function moveDrag(s: DragState, worldX: number, worldY: number, boundX = DRAG_BOUNDS_X): void {
  if (!s.dragging) return
  s.targetX = clampTarget(worldX - s.offX, -boundX, boundX)
  s.targetY = clampTarget(worldY - s.offY, DRAG_MIN_Y, DRAG_MAX_Y)
}

/** Let go: velocity is preserved, gravity takes over in updateDrag. */
export function endDrag(s: DragState): void {
  s.dragging = false
}

/** Advance one frame. motion: 1 normally, 0 for reduced motion (no gravity or bounce). */
export function updateDrag(s: DragState, dt: number, motion: number): void {
  if (dt <= 0) return
  if (motion <= 0) {
    updateReduced(s, dt)
    return
  }
  if (s.dragging) {
    // Ease toward the pointer; velocity is tracked so the release throw matches the hand.
    s.x = MathUtils.damp(s.x, s.targetX, DRAG_FOLLOW, dt)
    s.y = MathUtils.damp(s.y, s.targetY, DRAG_FOLLOW, dt)
    const ivx = (s.x - s.prevX) / dt
    const ivy = (s.y - s.prevY) / dt
    s.vx = MathUtils.damp(s.vx, MathUtils.clamp(ivx, -MAX_THROW_SPEED, MAX_THROW_SPEED), VELOCITY_SMOOTHING, dt)
    s.vy = MathUtils.damp(s.vy, MathUtils.clamp(ivy, -MAX_THROW_SPEED, MAX_THROW_SPEED), VELOCITY_SMOOTHING, dt)
    s.prevX = s.x
    s.prevY = s.y
    s.squash = MathUtils.damp(s.squash, HELD_STRETCH, TILT_FOLLOW, dt)
    s.tilt = MathUtils.damp(s.tilt, MathUtils.clamp(-s.vx * TILT_PER_VELOCITY, -MAX_TILT, MAX_TILT), TILT_FOLLOW, dt)
    return
  }
  // Flying: gravity + weak homing spring on x + air drag.
  s.vy -= GRAVITY * dt
  s.vx += (-HOME_STIFFNESS * s.x - HOME_DAMPING * s.vx) * dt
  s.vx *= 1 - AIR_DRAG * dt
  s.x += s.vx * dt
  s.y += s.vy * dt
  // Ground: bounce with squash, or settle when slow.
  if (s.y <= 0) {
    s.y = 0
    const impact = Math.abs(s.vy)
    if (impact > BOUNCE_MIN) {
      s.vy = impact * BOUNCE // vy was negative: bounce back up
      s.vx *= GROUND_FRICTION
      s.squashVel -= impact * SQUASH_ON_LAND // why: downward hit -> squash wide (negative)
    } else {
      s.vy = 0
      s.vx = MathUtils.damp(s.vx, 0, 6, dt)
      if (Math.abs(s.vx) < REST_VELOCITY && Math.abs(s.x) < 0.02) {
        s.x = 0
        s.vx = 0
      }
    }
  }
  stepSquash(s, dt)
  s.tilt = MathUtils.damp(
    s.tilt, s.y > 0.001 ? MathUtils.clamp(-s.vx * TILT_PER_VELOCITY, -MAX_TILT, MAX_TILT) : 0, TILT_FOLLOW, dt,
  )
}

/** Reduced motion: no throw, no bounce. Drift gently, settle flat. */
function updateReduced(s: DragState, dt: number): void {
  if (s.dragging) {
    s.x = MathUtils.damp(s.x, s.targetX, 6, dt)
    s.y = MathUtils.damp(s.y, s.targetY, 6, dt)
  } else {
    s.x = MathUtils.damp(s.x, 0, 4, dt)
    s.y = MathUtils.damp(s.y, 0, 4, dt)
  }
  s.vx = 0
  s.vy = 0
  s.prevX = s.x
  s.prevY = s.y
  s.squash = MathUtils.damp(s.squash, 0, 6, dt)
  s.squashVel = 0
  s.tilt = MathUtils.damp(s.tilt, 0, 6, dt)
}

/** Damped squash spring, stepped in small slices so a long frame can't make it explode. */
function stepSquash(s: DragState, dt: number): void {
  const steps = Math.ceil(dt / (1 / 120))
  const h = dt / steps
  for (let i = 0; i < steps; i++) {
    s.squashVel += (-SQUASH_STIFFNESS * s.squash - SQUASH_DAMPING * s.squashVel) * h
    s.squash += s.squashVel * h
  }
  s.squash = MathUtils.clamp(s.squash, -MAX_SQUASH, MAX_SQUASH)
}
