// The character root. Owns the animation state and the groups the animation layers move:
//   root   rigid motion (bob, sway, turn, hop)
//   torso  non-rigid motion (breathing, stretch and squash); body and face both live inside it
// All the animation logic is in ./animation; this component only wires it to the scene.
import { useRef, type RefObject } from 'react'
import type { Group, Mesh } from 'three'
import PickleBody, { BODY_BOTTOM_X, BODY_BOTTOM_Y } from './PickleBody'
import PickleFace from './PickleFace'
import type { ExpressionName } from './ExpressionController'
import { createCharacterState } from './animation/characterState'
import { useCharacterAnimation } from './animation/useCharacterAnimation'
import type { PointerState } from '../../hooks/useMousePosition'
import { materials } from './materials'

const GROUND_Y = BODY_BOTTOM_Y - 0.08 // same gap below the feet as before

interface PickleRickProps {
  /** Base expression. Cursor reactions can override it for a moment. */
  expression?: ExpressionName
  pointer: RefObject<PointerState>
  reducedMotion?: boolean
}

export default function PickleRick({ expression = 'idle', pointer, reducedMotion = false }: PickleRickProps) {
  // One mutable state object shared with the face. Changing it never re-renders React.
  const state = useRef(createCharacterState())
  const root = useRef<Group>(null)
  const torso = useRef<Group>(null)
  const shadow = useRef<Mesh>(null)

  useCharacterAnimation(state, { root, torso, shadow }, { expression, pointer, reducedMotion })

  return (
    <group>
      {/* YXZ: turn left/right first, then tip forward/back, like a head. */}
      <group ref={root} rotation-order="YXZ">
        <group ref={torso}>
          <PickleBody />
          <PickleFace stateRef={state} pointer={pointer} />
        </group>
      </group>
      {/* Soft fake shadow: cheaper than real shadow maps. Outside the moving groups so it stays on the ground. */}
      <mesh ref={shadow} material={materials.shadow} position={[BODY_BOTTOM_X, GROUND_Y, 0]} rotation-x={-Math.PI / 2} scale={[1, 0.8, 1]}>
        <circleGeometry args={[0.6, 32]} />
      </mesh>
    </group>
  )
}
