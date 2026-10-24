// Responsive framing math (pure, no React): keeps the character fully visible on narrow
// portrait phone screens by dollying the camera out, and keeps the dragged pickle on screen
// by shrinking the drag bounds to the visible width. Desktop framing is deliberately unchanged.
import { MathUtils } from 'three'
import { DRAG_BOUNDS_X } from '../components/PickleRick/animation/dragLayer'

export const CAMERA_FOV = 35 // vertical field of view, degrees (matches <PerspectiveCamera fov>)
export const BASE_DISTANCE = 7.4 // camera z on desktop: frames the character, legs and nearby props
const FIT_HALF_W = 1.7 // narrow screens dolly out until this half-width fits (character + arms + margin)
const DRAG_EDGE_MARGIN = 0.7 // the dragged pickle stays this far inside the screen edge
const MIN_DRAG_BOUND = 1.0 // even on the narrowest phone, allow a little sideways play

const HALF_FOV_TAN = Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180)

/** Camera z for an aspect ratio (width/height). Common desktop aspects return BASE_DISTANCE untouched. */
export function fitDistance(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return BASE_DISTANCE
  return Math.max(BASE_DISTANCE, FIT_HALF_W / (HALF_FOV_TAN * aspect))
}

/** Horizontal drag clamp for the live camera: visible half-width at the z=0 play plane minus margin. */
export function dragBoundX(cameraZ: number, aspect: number): number {
  if (!Number.isFinite(cameraZ) || !Number.isFinite(aspect) || cameraZ <= 0 || aspect <= 0) {
    return DRAG_BOUNDS_X
  }
  const visible = HALF_FOV_TAN * cameraZ * aspect - DRAG_EDGE_MARGIN
  return MathUtils.clamp(visible, MIN_DRAG_BOUND, DRAG_BOUNDS_X)
}
