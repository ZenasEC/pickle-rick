// Layer 1, base idle: always running, whatever the cursor does.
// Breathing, sway, bob, a slow weight shift and an occasional fidget. Phases are accumulated
// (not computed from the clock) so changing `energy` speeds motion up without a visible jump.
import { MathUtils } from 'three'

const BREATH_SPEED = 1.6
const BREATH_AMOUNT = 0.015
const SWAY_ANGLE = 0.03
const SWAY_SPEED = 0.7
const BOB_HEIGHT = 0.03
const BOB_SPEED = 1.1
const TURN_ANGLE = 0.045 // slow shifting of weight left and right
const TURN_SPEED = 0.31
const NOD_ANGLE = 0.02
const NOD_SPEED = 0.43
const FIDGET_TILT = 0.06
const FIDGET_DURATION = 1.6
const FIDGET_MIN_GAP = 7
const FIDGET_MAX_GAP = 15

export interface IdleState {
  // Outputs
  /** Body scale change: wider and slightly shorter on the inhale. */
  breath: number
  /** Roll (radians). */
  sway: number
  /** Height offset. */
  bob: number
  /** Yaw (radians). */
  turn: number
  /** Pitch (radians). */
  nod: number
  // Internal
  phase: { breath: number; sway: number; bob: number; turn: number; nod: number }
  fidgetStart: number
  fidgetDir: number
  nextFidget: number
}

export function createIdle(): IdleState {
  return {
    breath: 0, sway: 0, bob: 0, turn: 0, nod: 0,
    phase: { breath: 0, sway: 0, bob: 0, turn: 0, nod: 0 },
    fidgetStart: -1, fidgetDir: 1, nextFidget: 5,
  }
}

/** Slightly lopsided wave: the breath in is slower than the breath out. */
const breathWave = (p: number) => Math.sin(p) * 0.85 + Math.sin(2 * p + 1) * 0.15

/** motion: 1 normally, 0 for reduced motion (everything here goes still). */
export function updateIdle(s: IdleState, t: number, dt: number, energy: number, motion: number): void {
  const p = s.phase
  p.breath += dt * BREATH_SPEED * energy
  p.sway += dt * SWAY_SPEED * energy
  p.bob += dt * BOB_SPEED * energy * energy
  p.turn += dt * TURN_SPEED
  p.nod += dt * NOD_SPEED

  s.breath = motion * BREATH_AMOUNT * (0.7 + 0.3 * energy) * breathWave(p.breath)
  s.bob = motion * BOB_HEIGHT * energy * Math.sin(p.bob)
  // Two sines at unrelated speeds, so the sway never visibly repeats.
  s.sway = motion * (SWAY_ANGLE * (0.7 * Math.sin(p.sway) + 0.3 * Math.sin(p.sway * 0.37 + 1.3)) + fidget(s, t))
  s.turn = motion * TURN_ANGLE * (0.7 * Math.sin(p.turn) + 0.3 * Math.sin(p.turn * 2.3 + 0.8))
  s.nod = motion * NOD_ANGLE * Math.sin(p.nod)
}

/** A rare, gentle head tilt to one side and back. Returns the roll to add to the sway. */
function fidget(s: IdleState, t: number): number {
  if (s.fidgetStart < 0 && t >= s.nextFidget) {
    s.fidgetStart = t
    s.fidgetDir = Math.random() < 0.5 ? -1 : 1
    s.nextFidget = t + FIDGET_DURATION + MathUtils.randFloat(FIDGET_MIN_GAP, FIDGET_MAX_GAP)
  }
  if (s.fidgetStart < 0) return 0
  const progress = (t - s.fidgetStart) / FIDGET_DURATION
  if (progress >= 1) {
    s.fidgetStart = -1
    return 0
  }
  return s.fidgetDir * FIDGET_TILT * Math.sin(Math.PI * progress) ** 2
}
