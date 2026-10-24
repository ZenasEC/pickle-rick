// The four limbs. Each is its own object with a clear name (ArmLeft, ArmRight, LegLeft, LegRight)
// and its own root group, so later phases can move, detach or drag one without touching the others.
// Joint angles come from the limb animation layer; this file only applies them, in useFrame, through refs.
import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Outlines } from '@react-three/drei'
import * as THREE from 'three'
import { materials, OUTLINE_COLOR } from '../materials'
import type { CharacterState } from '../animation/characterState'
import { FOOT, LIMBS, SEGMENTS, type LimbId } from './limbConfig'

const OUTLINE_THICKNESS = 0.012
// Hand: a mitten palm, three fingers fanned slightly and a thumb pointing forward.
const PALM_RADIUS = 0.068
const FINGERS: [x: number, rotZ: number][] = [[-0.032, 0.25], [0, 0], [0.032, -0.25]]

// Shared by all limbs: created once, like the materials.
const capsule = (kind: 'arm' | 'leg', part: 'upper' | 'lower') =>
  new THREE.CapsuleGeometry(SEGMENTS[kind].radius, SEGMENTS[kind][part], 4, 10)
const geometries = {
  arm: { upper: capsule('arm', 'upper'), lower: capsule('arm', 'lower') },
  leg: { upper: capsule('leg', 'upper'), lower: capsule('leg', 'lower') },
  palm: new THREE.SphereGeometry(PALM_RADIUS, 12, 8),
  finger: new THREE.CapsuleGeometry(0.022, 0.05, 3, 6),
  foot: new THREE.SphereGeometry(FOOT.radius, 14, 10),
}

interface LimbProps {
  stateRef: RefObject<CharacterState>
}

function Limb({ id, stateRef }: LimbProps & { id: LimbId }) {
  const def = LIMBS[id]
  const seg = SEGMENTS[def.kind]
  const geo = geometries[def.kind]
  const upper = useRef<THREE.Group>(null)
  const lower = useRef<THREE.Group>(null)
  const end = useRef<THREE.Group>(null)

  useFrame(() => {
    const j = stateRef.current.limbs.joints[id]
    // Z is mirrored by side so "outward" means the same thing on both sides.
    upper.current?.rotation.set(j.upperX, 0, def.side * j.upperZ)
    lower.current?.rotation.set(j.lowerX, 0, def.side * j.lowerZ)
    if (def.kind === 'leg' && end.current) {
      // Undo the leg's bends so the foot stays flat on the floor (close enough for these small angles).
      end.current.rotation.set(-(j.upperX + j.lowerX), 0, -(def.socket.rotation[2] + def.side * (j.upperZ + j.lowerZ)))
    }
  })

  return (
    // Limb root: identity while attached to its socket. Moving this group moves the whole limb.
    <group name={def.partName}>
      <group ref={upper} name={`${def.partName}Upper`}>
        <mesh geometry={geo.upper} material={materials.limb} position={[0, -seg.upper / 2, 0]}>
          <Outlines thickness={OUTLINE_THICKNESS} color={OUTLINE_COLOR} />
        </mesh>
        <group ref={lower} name={`${def.partName}Lower`} position={[0, -seg.upper, 0]}>
          <mesh geometry={geo.lower} material={materials.limb} position={[0, -seg.lower / 2, 0]}>
            <Outlines thickness={OUTLINE_THICKNESS} color={OUTLINE_COLOR} />
          </mesh>
          <group ref={end} name={`${def.partName}${def.kind === 'arm' ? 'Hand' : 'Foot'}`} position={[0, -seg.lower, 0]}>
            {def.kind === 'arm' ? <Hand /> : <Foot />}
          </group>
        </group>
      </group>
    </group>
  )
}

function Hand() {
  return (
    <group>
      <mesh geometry={geometries.palm} material={materials.limb} position={[0, -0.055, 0]} scale={[1, 1.1, 0.6]}>
        <Outlines thickness={OUTLINE_THICKNESS} color={OUTLINE_COLOR} />
      </mesh>
      {FINGERS.map(([x, rotZ], i) => (
        <mesh key={i} geometry={geometries.finger} material={materials.limb} position={[x, -0.12, 0]} rotation-z={rotZ}>
          <Outlines thickness={OUTLINE_THICKNESS} color={OUTLINE_COLOR} />
        </mesh>
      ))}
      <mesh geometry={geometries.finger} material={materials.limb} position={[0, -0.05, 0.05]} rotation-x={-1.1}>
        <Outlines thickness={OUTLINE_THICKNESS} color={OUTLINE_COLOR} />
      </mesh>
    </group>
  )
}

function Foot() {
  return (
    <mesh geometry={geometries.foot} material={materials.limb} position={[0, -FOOT.drop, FOOT.forward]} scale={FOOT.scale}>
      <Outlines thickness={OUTLINE_THICKNESS} color={OUTLINE_COLOR} />
    </mesh>
  )
}

export const ArmLeft = (props: LimbProps) => <Limb id="leftArm" {...props} />
export const ArmRight = (props: LimbProps) => <Limb id="rightArm" {...props} />
export const LegLeft = (props: LimbProps) => <Limb id="leftLeg" {...props} />
export const LegRight = (props: LimbProps) => <Limb id="rightLeg" {...props} />
