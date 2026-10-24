// Places every face part on the upper front of the body and applies the animation state to
// the eyes and brows every frame. It decides nothing itself: blink timing, expression easing
// and eye micro-movements are computed by the animation layers and only read here.
import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Outlines } from '@react-three/drei'
import * as THREE from 'three'
import Eye from './Eye'
import Mouth from './Mouth'
import { materials, OUTLINE_COLOR } from './materials'
import { surfaceZ } from './bodyShape'
import type { CharacterState } from './animation/characterState'
import { useEyeTracking } from '../../hooks/useEyeTracking'
import type { PointerState } from '../../hooks/useMousePosition'

// --- Face layout (body units; the body is ~2.8 tall and ~1.14 wide) ---
// The eyes are deliberately mismatched: the right one is bigger and sits a little higher,
// and the pupils are aimed slightly apart. Small asymmetries read as "slightly unhinged".
const EYES = {
  left: { x: -0.2, y: 0.68, radius: 0.215, pupilOffset: [0, -0.04] as [number, number] },
  right: { x: 0.205, y: 0.695, radius: 0.235, pupilOffset: [-0.035, 0] as [number, number] },
}
const EYE_EMBED = 0.1 // how deep the eyeball center sits inside the body
const BROW_Y = 0.93 // height of the joint in the middle, where the two halves meet
const BROW_HALF_SPAN = 0.38 // each half reaches this far from the center
const BROW_CURVE = 1.05 // plate curve: the ends rise by this much x². Make it negative for a dome instead
const BROW_THICKNESS = 0.058
const BROW_STEPS = 8
const NOSE_Y = 0.4
const NOSE_RADIUS = 0.06
const OUTLINE_BROW = 0.014
const OUTLINE_NOSE = 0.014

const eyePosition = ({ x, y }: { x: number; y: number }): [number, number, number] => [x, y, surfaceZ(x, y) - EYE_EMBED]

/**
 * Path of one brow half, from the center joint (x = 0) outward. side: -1 = left, +1 = right.
 * Points are relative to the joint. Z follows the body surface so the brow hugs the curved head.
 */
function createBrowCurve(side: 1 | -1) {
  const points = Array.from({ length: BROW_STEPS + 1 }, (_, i) => {
    const x = (side * BROW_HALF_SPAN * i) / BROW_STEPS
    const y = BROW_CURVE * x * x
    return new THREE.Vector3(x, y, surfaceZ(x, BROW_Y + y) + 0.015)
  })
  return new THREE.CatmullRomCurve3(points)
}

interface PickleFaceProps {
  stateRef: RefObject<CharacterState>
  pointer: RefObject<PointerState>
}

export default function PickleFace({ stateRef, pointer }: PickleFaceProps) {
  const leftEye = useRef<THREE.Group>(null)
  const rightEye = useRef<THREE.Group>(null)
  const leftPivot = useRef<THREE.Group>(null)
  const rightPivot = useRef<THREE.Group>(null)
  const leftPupil = useRef<THREE.Group>(null)
  const rightPupil = useRef<THREE.Group>(null)
  const leftBrow = useRef<THREE.Group>(null)
  const rightBrow = useRef<THREE.Group>(null)

  // The micro-movement object is created once and mutated, so passing it here is stable.
  useEyeTracking([leftEye, rightEye], [leftPivot, rightPivot], pointer, stateRef.current.eyeMicro)

  useFrame(() => {
    const { pose, blink, eyeMicro } = stateRef.current

    // Lids: expression openness (squint) times the blink.
    const height = pose.eyeScale * pose.eyeOpen * blink.openness
    for (const eye of [leftEye.current, rightEye.current]) eye?.scale.set(pose.eyeScale, height, pose.eyeScale)
    const pupilScale = pose.pupilScale * (1 + eyeMicro.pupil)
    leftPupil.current?.scale.setScalar(pupilScale)
    rightPupil.current?.scale.setScalar(pupilScale)

    // Pose rotZ means "inner end up". The brows mirror each other, so the right one flips sign.
    if (leftBrow.current) {
      leftBrow.current.position.y = BROW_Y + pose.browLeft.y
      leftBrow.current.rotation.z = pose.browLeft.rotZ
    }
    if (rightBrow.current) {
      rightBrow.current.position.y = BROW_Y + pose.browRight.y
      rightBrow.current.rotation.z = -pose.browRight.rotZ
    }
  })

  return (
    <group>
      <Eye
        position={eyePosition(EYES.left)} radius={EYES.left.radius} pupilOffset={EYES.left.pupilOffset}
        eyeRef={leftEye} pivotRef={leftPivot} pupilRef={leftPupil}
      />
      <Eye
        position={eyePosition(EYES.right)} radius={EYES.right.radius} pupilOffset={EYES.right.pupilOffset}
        eyeRef={rightEye} pivotRef={rightPivot} pupilRef={rightPupil}
      />

      {/* Two halves that meet in the middle: they look like one joined brow, but each side can still tilt. */}
      <BrowHalf side={-1} browRef={leftBrow} name="leftBrow" />
      <BrowHalf side={1} browRef={rightBrow} name="rightBrow" />

      {/* Small and stretched downward: a round ball nose looks like a clown/mascot. */}
      <mesh name="nose" material={materials.nose} position={[0, NOSE_Y, surfaceZ(0, NOSE_Y)]} scale={[0.85, 1.25, 1]}>
        <sphereGeometry args={[NOSE_RADIUS, 16, 12]} />
        <Outlines thickness={OUTLINE_NOSE} color={OUTLINE_COLOR} />
      </mesh>

      <Mouth stateRef={stateRef} />
    </group>
  )
}

/** One half of the brow: a curved tube with round ends. Its group origin is the center joint, so tilting pivots there. */
function BrowHalf({ side, browRef, name }: { side: 1 | -1; browRef: RefObject<THREE.Group | null>; name: string }) {
  const curve = useMemo(() => createBrowCurve(side), [side])
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 16, BROW_THICKNESS, 8, false), [curve])
  return (
    <group ref={browRef} name={name} position={[0, BROW_Y, 0]}>
      <mesh geometry={tube} material={materials.brow}>
        <Outlines thickness={OUTLINE_BROW} color={OUTLINE_COLOR} />
      </mesh>
      {/* Spheres cap the open tube ends (the center cap also hides the seam when the halves tilt differently). */}
      {[curve.getPoint(0), curve.getPoint(1)].map((p, i) => (
        <mesh key={i} position={p} material={materials.brow}>
          <sphereGeometry args={[BROW_THICKNESS, 10, 8]} />
          <Outlines thickness={OUTLINE_BROW} color={OUTLINE_COLOR} />
        </mesh>
      ))}
    </group>
  )
}
