// Layer 6, aura: the character's cartoon glow. A soft shell around the body, a halo on the
// ground, and expanding rings on big moments (hard landings, startles, happy arrivals).
// Color follows the displayed face, brightness follows excitement + motion. All plain numbers:
// the meshes in ../Aura.tsx only read. Bursts and flashes are motion, so call sites skip them
// under reduced motion; the faint glow itself stays.
import { MathUtils } from 'three'
import type { ExpressionName } from '../ExpressionController'

export const RING_LIFE = 0.7 // seconds per burst ring, edge to fade
export const RING_COUNT = 4 // pooled rings: a double hop + a startle never needs more

const BASE_GLOW = 0.22 // faint presence even at rest
const ENERGY_GLOW = 0.25 // excited (energy 2) burns brighter, smug (0.7) dimmer
const KICK_GLOW = 1.2 // hops and stomps flare the aura, capped below
const MAX_KICK_GLOW = 0.5
const DRAG_GLOW = 0.25 // being carried glows
const SPEED_GLOW = 0.06 // flying fast glows, capped below
const MAX_SPEED_GLOW = 0.3
const GLOW_FOLLOW = 5 // brightness eases (lower = dreamier)
const FLASH_FOLLOW = 6 // flashes decay fast
const COLOR_FOLLOW = 3 // mood color creeps, so quick overrides don't strobe

/** Mood color per expression, as 0..1 channels. Super Saiyan golden aura identity across all moods. */
export const AURA_COLORS: Record<ExpressionName, { r: number; g: number; b: number }> = {
  idle: { r: 1.0, g: 0.88, b: 0.22 }, // Pure Super Saiyan Golden Yellow
  curious: { r: 0.98, g: 0.92, b: 0.3 },
  surprised: { r: 1.0, g: 0.96, b: 0.45 },
  angry: { r: 1.0, g: 0.65, b: 0.15 }, // Fiery deep golden-amber rage
  smug: { r: 0.96, g: 0.84, b: 0.25 },
  excited: { r: 1.0, g: 0.98, b: 0.5 }, // Blinding maximum golden aura
}

export interface AuraRing {
  active: boolean
  /** Seconds since spawn. */
  age: number
  /** Ground x where it burst (follows the throw position, not the live one). */
  x: number
}

export interface AuraState {
  /** 0..1 smoothed brightness. */
  glow: number
  /** 0..1 impulse that decays fast: landings, startles. */
  flash: number
  /** Current damped color channels. */
  color: { r: number; g: number; b: number }
  rings: AuraRing[]
}

export function createAura(): AuraState {
  return {
    glow: BASE_GLOW,
    flash: 0,
    color: { ...AURA_COLORS.idle },
    rings: Array.from({ length: RING_COUNT }, () => ({ active: false, age: 0, x: 0 })),
  }
}

/** Add brightness; call sites gate on motion (see header). Capped so overlaps can't blow out. */
export function auraFlash(a: AuraState, amount: number): void {
  a.flash = Math.min(1, a.flash + amount)
}

/** Start a ground burst. Reuses the oldest ring when all are busy. */
export function spawnRing(a: AuraState, x: number): void {
  let slot = a.rings.find((r) => !r.active)
  if (!slot) slot = a.rings.reduce((oldest, r) => (r.age > oldest.age ? r : oldest))
  slot.active = true
  slot.age = 0
  slot.x = x
}

/**
 * Ease glow/color toward the live inputs, age the rings.
 * face: the displayed expression (override or base). energy: pose.energy. kick: applied kick
 * (already scaled by motion at the call site). speed: drag velocity. dragging: currently held.
 */
export function updateAura(
  a: AuraState,
  face: ExpressionName,
  energy: number,
  kick: number,
  speed: number,
  dragging: boolean,
  dt: number,
): void {
  if (dt <= 0) return
  const target = MathUtils.clamp(
    BASE_GLOW +
      (energy - 1) * ENERGY_GLOW +
      Math.min(Math.abs(kick) * KICK_GLOW, MAX_KICK_GLOW) +
      (dragging ? DRAG_GLOW : 0) +
      Math.min(speed * SPEED_GLOW, MAX_SPEED_GLOW),
    0,
    1,
  )
  a.glow = MathUtils.damp(a.glow, target, GLOW_FOLLOW, dt)
  a.flash = MathUtils.damp(a.flash, 0, FLASH_FOLLOW, dt)
  const c = AURA_COLORS[face] ?? AURA_COLORS.idle
  a.color.r = MathUtils.damp(a.color.r, c.r, COLOR_FOLLOW, dt)
  a.color.g = MathUtils.damp(a.color.g, c.g, COLOR_FOLLOW, dt)
  a.color.b = MathUtils.damp(a.color.b, c.b, COLOR_FOLLOW, dt)
  for (const r of a.rings) {
    if (!r.active) continue
    r.age += dt
    if (r.age >= RING_LIFE) r.active = false
  }
}
