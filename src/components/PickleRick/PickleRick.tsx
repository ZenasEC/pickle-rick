// The character root. Owns the animation state and the groups the animation layers move:
//   drag    drag-and-drop physics offset (position + lean), home is (0, 0, 0)
//   root    rigid motion (bob, sway, turn, hop)
//   torso   non-rigid motion (breathing, stretch and squash); body, face and limb sockets live inside it
//   socket  one named attachment point per limb (LeftArmSocket ...); each limb renders inside its socket
// All the animation logic is in ./animation; this component only wires it to the scene.
import { useRef, type RefObject } from 'react'
import type { Group, Mesh } from 'three'
import PickleBody from './PickleBody'
import PickleFace from './PickleFace'
import { AuraGround, AuraShell } from './Aura'
import type { ExpressionName } from './ExpressionController'
import { createCharacterState } from './animation/characterState'
import { useCharacterAnimation } from './animation/useCharacterAnimation'
import type { PointerState } from '../../hooks/useMousePosition'
import { useDragInteraction } from '../../hooks/useDragInteraction'
import { materials } from './materials'
import { BODY_BOTTOM_X } from './bodyShape'
import { GROUND_Y } from './limbs/limbConfig'
import LimbSocket from './limbs/LimbSocket'
import { ArmLeft, ArmRight, LegLeft, LegRight } from './limbs/Limb'

const SHADOW_GAP = 0.004 // just above the ground, so it doesn't flicker against it

interface PickleRickProps {
  /** Base expression. Cursor reactions (and holding) can override it for a moment. */
  expression?: ExpressionName
  pointer: RefObject<PointerState>
  reducedMotion?: boolean
  /** Aura meshes (flames, lightning, glow). State keeps updating while hidden, so it returns seamlessly. */
  auraOn?: boolean
}

export default function PickleRick({ expression = 'idle', pointer, reducedMotion = false, auraOn = true }: PickleRickProps) {
  // One mutable state object shared with the face and limbs. Changing it never re-renders React.
  const state = useRef(createCharacterState())
  const drag = useRef<Group>(null)
  const root = useRef<Group>(null)
  const torso = useRef<Group>(null)
  const shadow = useRef<Mesh>(null)

  useCharacterAnimation(state, { drag, root, torso, shadow }, { expression, pointer, reducedMotion })
  const dragHandlers = useDragInteraction(state)

  return (
    <group name="PickleCharacter">
      {/* Drag group: the whole character (but not its ground shadow) is grabbable. */}
      <group ref={drag} name="PickleDrag" {...dragHandlers}>
        {/* YXZ: turn left/right first, then tip forward/back, like a head. */}
        <group ref={root} rotation-order="YXZ">
          <group ref={torso}>
            {auraOn && <AuraShell stateRef={state} reducedMotion={reducedMotion} />}
            <PickleBody />
            <PickleFace stateRef={state} pointer={pointer} />
            <LimbSocket id="leftArm"><ArmLeft stateRef={state} /></LimbSocket>
            <LimbSocket id="rightArm"><ArmRight stateRef={state} /></LimbSocket>
            <LimbSocket id="leftLeg"><LegLeft stateRef={state} /></LimbSocket>
            <LimbSocket id="rightLeg"><LegRight stateRef={state} /></LimbSocket>
          </group>
        </group>
      </group>
      {/* Soft fake shadow: cheaper than real shadow maps. Outside the moving groups so it stays on the ground. */}
      <mesh
        ref={shadow} material={materials.shadow} position={[BODY_BOTTOM_X, GROUND_Y + SHADOW_GAP, 0.05]}
        rotation-x={-Math.PI / 2} scale={[1, 0.8, 1]}
      >
        <circleGeometry args={[0.6, 32]} />
      </mesh>
      {auraOn && <AuraGround stateRef={state} />}
    </group>
  )
}
