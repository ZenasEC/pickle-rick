// Synthesized sound effects: every sound is an oscillator + gain envelope built in code,
// so the project still ships zero audio files. The AudioContext is created lazily on the
// first play call (browsers block audio before a user gesture) and every play function is
// a safe no-op on the server, in muted state, or before that first gesture.
import { MathUtils } from 'three'

const MASTER_GAIN = 0.5 // all sounds are mixed quietly under the visuals
const MUTE_KEY = 'pickle-muted'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false

export function setMuted(m: boolean): void {
  muted = m
  if (master && ctx) master.gain.setValueAtTime(m ? 0 : MASTER_GAIN, ctx.currentTime)
}

export function isMuted(): boolean {
  return muted
}

/** Mute choice survives reloads. Guarded: safe to call during server rendering. */
export function loadMuted(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false // private mode: just don't remember
  }
}

export function saveMuted(m: boolean): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(MUTE_KEY, m ? '1' : '0')
  } catch {
    // private mode: hearing sound once is fine, remembering is not required
  }
}

/** Shared setup: returns null whenever playing is impossible or unwanted (play calls bail out). */
function audio(): { ctx: AudioContext; master: GainNode } | null {
  if (muted || typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = MASTER_GAIN
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume() // first gesture unlocks it; later calls just play
  if (!master) return null
  return { ctx, master }
}

interface Tone {
  /** Oscillator shape: 'square' pops, 'sine' boings, 'triangle' chirps. */
  type: OscillatorType
  /** Pitch slide from -> to (Hz). Equal values = flat beep. */
  from: number
  to: number
  /** Seconds. */
  dur: number
  /** Peak loudness 0..1 (master gain scales it down further). */
  gain: number
  /** Start this many seconds after now, for two-part sounds. */
  delay?: number
}

/** One enveloped oscillator: quick fade-in avoids clicks, exponential decay sounds natural. */
function tone(c: AudioContext, out: GainNode, { type, from, to, dur, gain, delay = 0 }: Tone): void {
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const env = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(Math.max(from, 1), t0)
  osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + dur)
  env.gain.setValueAtTime(0, t0)
  env.gain.linearRampToValueAtTime(gain, t0 + 0.008)
  env.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  osc.connect(env).connect(out)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

/** Grab: short upward square pop. */
export function playPop(): void {
  const a = audio()
  if (!a) return
  tone(a.ctx, a.master, { type: 'square', from: 420, to: 880, dur: 0.08, gain: 0.25 })
}

/** UI click: tiny flat blip. */
export function playClick(): void {
  const a = audio()
  if (!a) return
  tone(a.ctx, a.master, { type: 'sine', from: 760, to: 760, dur: 0.05, gain: 0.2 })
}

/** Throw: rising whistle, louder/faster with release speed 0..1. */
export function playWhoosh(speed: number): void {
  const a = audio()
  if (!a) return
  const p = whooshParams(speed)
  tone(a.ctx, a.master, { type: 'triangle', from: p.from, to: p.to, dur: p.dur, gain: p.gain })
}

/** Landing: springy downward boing, deeper and longer with impact speed. */
export function playBoing(impact: number): void {
  const a = audio()
  if (!a) return
  const p = boingParams(impact)
  tone(a.ctx, a.master, { type: 'sine', from: p.from, to: p.to, dur: p.dur, gain: p.gain })
  // Second wobble a touch later: the "oi-oi" of a cartoon bounce.
  tone(a.ctx, a.master, { type: 'sine', from: p.from * 1.2, to: p.to, dur: p.dur * 0.8, gain: p.gain * 0.5, delay: p.dur * 0.55 })
}

/** Startled by a fast cursor flick: quick double gasp. */
export function playStartle(): void {
  const a = audio()
  if (!a) return
  tone(a.ctx, a.master, { type: 'triangle', from: 620, to: 940, dur: 0.07, gain: 0.22 })
  tone(a.ctx, a.master, { type: 'triangle', from: 700, to: 1050, dur: 0.08, gain: 0.2, delay: 0.08 })
}

/** Happy arrival / excited: bright rising chirp. */
export function playChirp(): void {
  const a = audio()
  if (!a) return
  tone(a.ctx, a.master, { type: 'triangle', from: 700, to: 1250, dur: 0.12, gain: 0.2 })
}

/** Angry: low grumble buzz. */
export function playGrumble(): void {
  const a = audio()
  if (!a) return
  tone(a.ctx, a.master, { type: 'sawtooth', from: 130, to: 90, dur: 0.25, gain: 0.22 })
}

// --- Pure parameter mappers (no audio): exported for unit tests. ---

const clamp01 = (v: number) => MathUtils.clamp(v, 0, 1)

/** Harder landing -> deeper pitch, longer ring, louder. impact: fall speed in world units/s. */
export function boingParams(impact: number): { from: number; to: number; dur: number; gain: number } {
  const k = clamp01(impact / 6)
  return { from: 320 - 140 * k, to: 150 - 60 * k, dur: 0.14 + 0.18 * k, gain: 0.25 + 0.25 * k }
}

/** Faster throw -> higher, longer whistle. speed: release speed 0..1. */
export function whooshParams(speed: number): { from: number; to: number; dur: number; gain: number } {
  const k = clamp01(speed)
  return { from: 220 + 180 * k, to: 480 + 320 * k, dur: 0.12 + 0.14 * k, gain: 0.12 + 0.18 * k }
}
