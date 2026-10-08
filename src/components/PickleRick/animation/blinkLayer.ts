// Natural blinking. Real blinks close fast and open slower, come at uneven intervals,
// sometimes twice in a row, and a startle can trigger one.
import { MathUtils } from 'three'

const CLOSE_TIME = 0.07
const OPEN_TIME = 0.12
const MIN_OPENNESS = 0.05
const BASE_GAP = 2.2 // gap = BASE_GAP + 0..GAP_SPREAD, leaning toward the middle
const GAP_SPREAD = 3.6
const DOUBLE_BLINK_CHANCE = 0.15
const DOUBLE_BLINK_GAP = [0.1, 0.2] as const
const MIN_SPACING = 0.3 // a blink request is ignored right after a blink

export interface BlinkState {
  /** Output: 1 = open, 0.05 = shut. Both eyes share it. */
  openness: number
  // Internal
  phase: 'open' | 'closing' | 'opening'
  phaseStart: number
  nextAt: number
  doubleNext: boolean
  lastEnd: number
}

export const createBlink = (): BlinkState => ({
  openness: 1, phase: 'open', phaseStart: 0, nextAt: 2.5, doubleNext: false, lastEnd: -1,
})

/** request: blink now if possible. rate: 1 = normal, 0.5 = half as often. */
export function updateBlink(b: BlinkState, t: number, request: boolean, rate: number): void {
  switch (b.phase) {
    case 'open':
      b.openness = 1
      if ((request && t - b.lastEnd > MIN_SPACING) || t >= b.nextAt) {
        b.phase = 'closing'
        b.phaseStart = t
      }
      break
    case 'closing': {
      const p = (t - b.phaseStart) / CLOSE_TIME
      if (p >= 1) {
        b.phase = 'opening'
        b.phaseStart = t
        b.openness = MIN_OPENNESS
      } else {
        b.openness = 1 - (1 - MIN_OPENNESS) * p * p // accelerates shut
      }
      break
    }
    case 'opening': {
      const p = (t - b.phaseStart) / OPEN_TIME
      if (p >= 1) {
        b.phase = 'open'
        b.openness = 1
        b.lastEnd = t
        scheduleNext(b, t, rate)
      } else {
        b.openness = MIN_OPENNESS + (1 - MIN_OPENNESS) * (1 - (1 - p) * (1 - p)) // decelerates open
      }
      break
    }
  }
}

function scheduleNext(b: BlinkState, t: number, rate: number): void {
  if (b.doubleNext) {
    b.doubleNext = false
    b.nextAt = t + MathUtils.randFloat(DOUBLE_BLINK_GAP[0], DOUBLE_BLINK_GAP[1])
    return
  }
  b.doubleNext = Math.random() < DOUBLE_BLINK_CHANCE
  const gap = BASE_GAP + ((Math.random() + Math.random()) / 2) * GAP_SPREAD
  b.nextAt = t + gap / Math.max(rate, 0.1)
}
