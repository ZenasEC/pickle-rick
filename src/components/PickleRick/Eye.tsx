// One eyeball. The pupil sits on a "pivot" group at the eyeball center, so rotating the pivot
// rolls the pupil across the curved eyeball surface (instead of sliding it flat).
import type { Ref } from 'react'
import type { Group } from 'three'
import { Outlines } from '@react-three/drei'
import { materials, OUTLINE_COLOR } from './materials'
import Pupil from './Pupil'

const OUTLINE_THICKNESS = 0.02

interface EyeProps {
  position: [number, number, number]
  radius: number
  /** Fixed extra aim [pitch, yaw] in radians, so the two pupils never line up perfectly. Tracking adds on top. */
  pupilOffset?: [number, number]
  /** Whole eye: scaled for blinking and wide-eyed expressions. */
  eyeRef: Ref<Group>
  /** Rotated by eye tracking. */
  pivotRef: Ref<Group>
  pupilRef: Ref<Group>
}

export default function Eye({ position, radius, pupilOffset = [0, 0], eyeRef, pivotRef, pupilRef }: EyeProps) {
  return (
    <group ref={eyeRef} position={position}>
      <mesh material={materials.eyeWhite}>
        <sphereGeometry args={[radius, 24, 16]} />
        <Outlines thickness={OUTLINE_THICKNESS} color={OUTLINE_COLOR} />
      </mesh>
      {/* YXZ order: turn left/right first, then up/down, like a real eye. */}
      <group ref={pivotRef} rotation-order="YXZ">
        <group rotation={[pupilOffset[0], pupilOffset[1], 0]}>
          <group position={[0, 0, radius]}>
            <Pupil pupilRef={pupilRef} />
          </group>
        </group>
      </group>
    </group>
  )
}
