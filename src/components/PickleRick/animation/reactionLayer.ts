// Layer 4, temporary reactions: short-lived responses to what the cursor does.
//   cursor flicks fast       -> startle: surprised face + a hop (a few in a row -> angry)
//   cursor comes near        -> curious (and the look layer leans in)
//   cursor rests on it       -> smug
//   cursor (re)enters window -> excited, two small hops
// A reaction never edits the base expression. It only asks for another one for a moment
// (`override`), and the expression layer eases there and back.
import { MathUtils } from 'three'
import { EXPRESSION_NAMES, type ExpressionName } from '../ExpressionController'
import type { CursorState } from './cursorLayer'

const RAPID_SPEED = 5 // smoothed NDC units per second that count as a flick
const STARTLE_COOLDOWN = 0.7
const STARTLE_IMPULSE = 5
const STOMP_IMPULSE = 2.5
const HOP_IMPULSE = 3.2
const ANNOYED_AT = 2.2 // annoyance that makes it angry: three flicks within a couple of seconds of each other (each one cools off a little)
const ANNOY_COOL_TIME = 6 // seconds for one flick to be forgotten
const SURPRISED_HOLD = 0.9
const ANGRY_HOLD = 3
const EXCITED_HOLD = 1.6
const NEAR_HOLD = 0.3 // continuous reactions are re-held every frame, so they end shortly after the cause does
const STILL_SPEED = 0.4
const SMUG_AFTER = 2.5 // seconds of resting near the character
const HOP_GAP = 0.32
const SPRING_STIFFNESS = 170
const SPRING_DAMPING = 11 // under-damped: one visible overshoot, which reads as a bounce

/** When several reactions are active, the first in this list wins. */
const PRIORITY: ExpressionName[] = ['angry', 'surprised', 'excited', 'smug', 'curious']

export interface ReactionState {
  /** Spring position: >0 hop up and stretch, <0 squash. */
  kick: number
  /** Face the reactions want right now, or null to show the base expression. */
  override: ExpressionName | null
  /** True for one frame when something wants a quick blink. */
  blinkRequest: boolean
  // Internal
  kickVel: number
  holds: Record<ExpressionName, number>
  cooldownUntil: number
  annoyance: number
  dwell: number
  hopsLeft: number
  nextHopAt: number
}

export function createReactions(): ReactionState {
  const holds = {} as Record<ExpressionName, number>
  for (const name of EXPRESSION_NAMES) holds[name] = 0
  return {
    kick: 0, override: null, blinkRequest: false,
    kickVel: 0, holds, cooldownUntil: 0, annoyance: 0, dwell: 0, hopsLeft: 0, nextHopAt: 0,
  }
}

export function updateReactions(r: ReactionState, cursor: CursorState, t: number, dt: number): void {
  r.blinkRequest = false
  detectFlick(r, cursor, t, dt)
  detectNearby(r, cursor, t, dt)
  detectArrival(r, cursor, t)
  runHops(r, t)
  stepSpring(r, dt)
  r.override = PRIORITY.find((name) => r.holds[name] > t) ?? null
}

/** Keep `name` requested for `seconds` more. */
function hold(r: ReactionState, name: ExpressionName, t: number, seconds: number): void {
  r.holds[name] = Math.max(r.holds[name], t + seconds)
}

function detectFlick(r: ReactionState, cursor: CursorState, t: number, dt: number): void {
  r.annoyance = Math.max(0, r.annoyance - dt / ANNOY_COOL_TIME)
  if (cursor.speed < RAPID_SPEED || t < r.cooldownUntil) return

  r.cooldownUntil = t + STARTLE_COOLDOWN
  r.kickVel += STARTLE_IMPULSE
  r.blinkRequest = true
  hold(r, 'surprised', t, SURPRISED_HOLD)
  r.annoyance += 1
  if (r.annoyance >= ANNOYED_AT) {
    r.annoyance = 0
    r.kickVel += STOMP_IMPULSE
    hold(r, 'angry', t, ANGRY_HOLD)
  }
}

function detectNearby(r: ReactionState, cursor: CursorState, t: number, dt: number): void {
  if (!cursor.inZone) {
    r.dwell = 0
    return
  }
  hold(r, 'curious', t, NEAR_HOLD)
  r.dwell = cursor.speed < STILL_SPEED ? r.dwell + dt : 0
  if (r.dwell > SMUG_AFTER) hold(r, 'smug', t, NEAR_HOLD)
}

function detectArrival(r: ReactionState, cursor: CursorState, t: number): void {
  if (!cursor.arrived) return
  hold(r, 'excited', t, EXCITED_HOLD)
  r.hopsLeft = 2
  r.nextHopAt = t
}

function runHops(r: ReactionState, t: number): void {
  if (r.hopsLeft <= 0 || t < r.nextHopAt) return
  r.kickVel += HOP_IMPULSE
  r.hopsLeft -= 1
  r.nextHopAt = t + HOP_GAP
}

/** Damped spring toward 0, stepped in small slices so a long frame can't make it explode. */
function stepSpring(r: ReactionState, dt: number): void {
  const steps = Math.ceil(dt / (1 / 120))
  const h = dt / steps
  for (let i = 0; i < steps; i++) {
    r.kickVel += (-SPRING_STIFFNESS * r.kick - SPRING_DAMPING * r.kickVel) * h
    r.kick += r.kickVel * h
  }
  r.kick = MathUtils.clamp(r.kick, -0.5, 0.5)
}
