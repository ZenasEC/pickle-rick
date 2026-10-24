// The pickle's shape as plain math, with no React or rendering: the outline, the lumps and the bend.
// The body mesh is built from it, and face parts and limb sockets use it to sit exactly on the surface.
import { MathUtils } from 'three'

// Body outline as [radius, height] pairs, bottom to top. Widest around the face, tapering
// toward a blunt bottom, with a broad flattish dome on top. Edit these to reshape the pickle.
export const PROFILE: [number, number][] = [
  [0, -1.36], [0.2, -1.33], [0.34, -1.24], [0.44, -1.08], [0.5, -0.8], [0.53, -0.4], [0.555, 0],
  [0.57, 0.4], [0.565, 0.75], [0.53, 1.02], [0.44, 1.24], [0.28, 1.39], [0, 1.44],
]
/** Y of the lowest point of the body, used to keep it in place when squashing. */
export const BODY_BOTTOM_Y = PROFILE[0][1]
const MAX_RADIUS = 0.57

// Below BEND_START the body curves sideways (more toward the bottom), so it is not a straight capsule.
// The face area stays practically unbent, and surfaceZ() accounts for the bend anyway.
const BEND = 0.035
const BEND_START = 0.1
/** Sideways shift of the body's center line at height y. */
export const bendX = (y: number) => BEND * Math.max(0, BEND_START - y) ** 2
/** X of the lowest point of the body after bending. */
export const BODY_BOTTOM_X = bendX(BODY_BOTTOM_Y)

/** Radius of the smooth outline at height y (straight-line interpolation between PROFILE points). */
export function profileRadius(y: number): number {
  for (let i = 1; i < PROFILE.length; i++) {
    const [r0, y0] = PROFILE[i - 1]
    const [r1, y1] = PROFILE[i]
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0)
  }
  return 0
}

/** Deterministic lumpiness: same every reload, no noise library needed. phi = angle around Y (0 = front). */
export function lump(phi: number, y: number): number {
  return (
    0.024 * Math.sin(3 * phi + y * 2.1) +
    0.014 * Math.sin(5 * phi - y * 3.7) +
    0.008 * Math.sin(y * 6.3) +
    0.006 * Math.sin(8 * phi + y * 1.7 + 0.5)
  )
}

/** Radius of the lumpy surface at height y and angle phi. Lumps fade to 0 at the tips so the poles stay closed. */
export function surfaceRadius(y: number, phi: number): number {
  const r = profileRadius(y)
  return r + lump(phi, y) * (r / MAX_RADIUS)
}

/** Z of the front surface at (x, y). Face parts use this to sit on the body instead of floating or sinking. */
export function surfaceZ(x: number, y: number): number {
  const xl = x - bendX(y)
  const phi = Math.asin(MathUtils.clamp(xl / Math.max(profileRadius(y), 1e-3), -1, 1))
  const r = surfaceRadius(y, phi)
  return Math.sqrt(Math.max(r * r - xl * xl, 0))
}

/**
 * A point on the body surface at height y and angle phi (0 = front, positive = screen right),
 * pushed `inset` units inward. Used for warts and limb sockets.
 */
export function surfacePoint(y: number, phi: number, inset = 0): [number, number, number] {
  const r = surfaceRadius(y, phi) - inset
  return [r * Math.sin(phi) + bendX(y), y, r * Math.cos(phi)]
}
