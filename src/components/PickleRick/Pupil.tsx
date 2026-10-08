// A tiny flat black pupil dot. No highlight: a shine dot makes eyes look cute and glossy, and
// this character should look a little unhinged instead. Origin = the point where it touches the eyeball.
import type { Ref } from 'react'
import type { Group } from 'three'
import { materials } from './materials'

const PUPIL_RADIUS = 0.034

export default function Pupil({ pupilRef }: { pupilRef: Ref<Group> }) {
  return (
    <group ref={pupilRef}>
      {/* Flattened sphere so it reads as a dot painted on the eye, slightly raised. */}
      <mesh material={materials.pupil} scale={[1, 1, 0.45]}>
        <sphereGeometry args={[PUPIL_RADIUS, 16, 12]} />
      </mesh>
    </group>
  )
}
