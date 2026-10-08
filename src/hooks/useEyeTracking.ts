// Makes pupils look at the mouse.
// 1. Cast a ray from the camera through the pointer and hit an invisible plane in front of the face: the look target.
// 2. For each eye, find the target relative to the eye center, turn that into yaw/pitch angles.
// 3. Clamp the angles so the pupil stays on the eyeball, then ease the pupil pivot toward them.
import { useMemo, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { PointerState } from './useMousePosition'

/** World Z of the invisible look plane. Closer to the face = eyes turn more. */
const LOOK_PLANE_Z = 2.5
/** Max pupil turn from center, radians (~28 degrees). Tuned so the pupil never leaves the white. */
export const MAX_PUPIL_ANGLE = 0.5
/** Higher = snappier eyes, lower = lazier. */
const PUPIL_DAMPING = 10

export interface PupilAngles {
  yaw: number
  pitch: number
}

/**
 * Pure math, no WebGL: angles that point +Z toward `local` (target relative to the eye center),
 * each clamped to ±maxAngle. Writes into `out` to avoid allocating every frame.
 */
export function computePupilAngles(local: THREE.Vector3, maxAngle: number, out: PupilAngles): PupilAngles {
  const yaw = Math.atan2(local.x, local.z)
  const pitch = Math.atan2(local.y, Math.hypot(local.x, local.z))
  out.yaw = THREE.MathUtils.clamp(yaw, -maxAngle, maxAngle)
  out.pitch = THREE.MathUtils.clamp(pitch, -maxAngle, maxAngle)
  return out
}

export function useEyeTracking(
  eyeRefs: RefObject<THREE.Group | null>[],
  pivotRefs: RefObject<THREE.Group | null>[],
  pointer: RefObject<PointerState>,
  /** Optional small extra aim (radians) from the eye micro-movement layer. Mutated by that layer, read here. */
  micro?: { yaw: number; pitch: number },
) {
  // Created once and reused every frame.
  const tools = useMemo(
    () => ({
      raycaster: new THREE.Raycaster(),
      ndc: new THREE.Vector2(),
      plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), -LOOK_PLANE_Z),
      target: new THREE.Vector3(),
      local: new THREE.Vector3(),
      angles: { yaw: 0, pitch: 0 } as PupilAngles,
    }),
    [],
  )

  useFrame(({ camera }, delta) => {
    const { raycaster, ndc, plane, target, local, angles } = tools
    const p = pointer.current
    let hasTarget = false
    if (p.active) {
      ndc.set(p.x, p.y)
      raycaster.setFromCamera(ndc, camera)
      hasTarget = raycaster.ray.intersectPlane(plane, target) !== null
    }

    eyeRefs.forEach((eyeRef, i) => {
      const eye = eyeRef.current
      const pivot = pivotRefs[i].current
      if (!eye || !pivot || !eye.parent) return
      if (hasTarget) {
        // Use the eye's parent space (not the eye itself) so blinking's squash scale doesn't distort the angles.
        local.copy(target)
        eye.parent.worldToLocal(local).sub(eye.position)
        computePupilAngles(local, MAX_PUPIL_ANGLE, angles)
      } else {
        angles.yaw = 0
        angles.pitch = 0
      }
      if (micro) {
        // Added before the final clamp, so micro-movements can never push a pupil off the eyeball.
        angles.yaw = THREE.MathUtils.clamp(angles.yaw + micro.yaw, -MAX_PUPIL_ANGLE, MAX_PUPIL_ANGLE)
        angles.pitch = THREE.MathUtils.clamp(angles.pitch + micro.pitch, -MAX_PUPIL_ANGLE, MAX_PUPIL_ANGLE)
      }
      pivot.rotation.y = THREE.MathUtils.damp(pivot.rotation.y, angles.yaw, PUPIL_DAMPING, delta)
      // Rotating around X by a positive angle tips +Z downward, so looking up needs a negative angle.
      pivot.rotation.x = THREE.MathUtils.damp(pivot.rotation.x, -angles.pitch, PUPIL_DAMPING, delta)
    })
  })
}
