// The mouth: a dark interior, a row of upper teeth and a tongue.
// Its shape is rebuilt every frame from the expression pose (open, width, smile/frown, smirk),
// with every point placed on the curved body surface, so the mouth hugs the pickle at any width.
// It is small (~60 vertices), so rewriting the vertices each frame is cheap.
import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Outlines } from '@react-three/drei'
import * as THREE from 'three'
import { materials, OUTLINE_COLOR } from './materials'
import { surfaceZ } from './bodyShape'
import type { CharacterState } from './animation/characterState'

/** Height of the mouth's top edge on the body when the corners are level. */
const MOUTH_Y = 0.29
const HALF_WIDTH = 0.35 // wide: the grin spans most of the face
const DEPTH = 0.3
const SMILE_AMOUNT = 0.1 // corner rise at mouthSmile = 1: sharp, upturned, sarcastic corners
const SKEW_AMOUNT = 0.06 // corner rise/drop at mouthSkew = 1
/** Shape of the lower lip: 0.5 = half-ellipse, lower = fuller, boxier "D" shape that reads as a manic grin. */
const BOTTOM_ROUNDNESS = 0.38
const COLUMNS = 20 // the interior is a strip of this many quads
const MIN_OPEN = 0.12 // never fully closed, so the mouth is always visible
const INTERIOR_GAP = 0.025 // distance above the body surface, to avoid z-fighting
const TONGUE_GAP = 0.035
const TOOTH_GAP = 0.03
const TOOTH_COUNT = 8
const TOOTH_SIZE: [number, number, number] = [0.058, 0.075, 0.02]
/** Uneven tooth lengths: a perfectly even row looks like a toy. One entry per tooth. */
const TOOTH_HEIGHTS = [0.85, 1.05, 0.9, 1.1, 1, 0.8, 1.05, 0.9]
const TEETH_SPAN = 0.72 // fraction of the mouth half-width the teeth cover
const TOOTH_OUTLINE = 0.006
const TONGUE_RX = 0.16
const TONGUE_RY = 0.085
const TONGUE_DROP = 0.68 // tongue center, as a fraction of the mouth depth
const TONGUE_SEGMENTS = 20

/** Height of the mouth's top edge at u (-1 = left corner, 1 = right corner). */
const topEdge = (u: number, smile: number, skew: number) => SMILE_AMOUNT * smile * u * u + SKEW_AMOUNT * skew * u

/** Height of the lower lip at u. */
const bottomEdge = (u: number, open: number, smile: number, skew: number) =>
  topEdge(u, smile, skew) - DEPTH * open * Math.max(1 - u * u, 0) ** BOTTOM_ROUNDNESS

function createInteriorGeometry() {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((COLUMNS + 1) * 2 * 3), 3))
  // Vertices alternate top, bottom for each column; each pair of columns makes two triangles.
  const index: number[] = []
  for (let i = 0; i < COLUMNS; i++) {
    const top = i * 2
    index.push(top, top + 1, top + 2, top + 2, top + 1, top + 3)
  }
  geometry.setIndex(index)
  return geometry
}

function createTongueGeometry() {
  // A flat disc; its original x/y are kept (in `rest`) and re-scaled onto the body each frame.
  const geometry = new THREE.CircleGeometry(1, TONGUE_SEGMENTS)
  const rest = Float32Array.from(geometry.attributes.position.array)
  return { geometry, rest }
}

export default function Mouth({ stateRef }: { stateRef: RefObject<CharacterState> }) {
  const interior = useMemo(createInteriorGeometry, [])
  const tongue = useMemo(createTongueGeometry, [])
  const toothGeometry = useMemo(() => new THREE.BoxGeometry(...TOOTH_SIZE), [])
  const teethRef = useRef<THREE.Group>(null)

  useFrame(() => {
    const { mouthOpen, mouthWidth, mouthSmile, mouthSkew } = stateRef.current.pose
    const open = THREE.MathUtils.lerp(MIN_OPEN, 1, THREE.MathUtils.clamp(mouthOpen, 0, 1))
    const halfWidth = HALF_WIDTH * mouthWidth

    // Interior: top edge follows the smile curve; the lower lip hangs below it.
    const pos = interior.attributes.position
    for (let i = 0; i <= COLUMNS; i++) {
      const u = -1 + (2 * i) / COLUMNS
      const x = u * halfWidth
      const top = topEdge(u, mouthSmile, mouthSkew)
      const bottom = bottomEdge(u, open, mouthSmile, mouthSkew)
      pos.setXYZ(i * 2, x, top, surfaceZ(x, MOUTH_Y + top) + INTERIOR_GAP)
      pos.setXYZ(i * 2 + 1, x, bottom, surfaceZ(x, MOUTH_Y + bottom) + INTERIOR_GAP)
    }
    pos.needsUpdate = true

    // Tongue: rests low in the mouth and grows with it. Every point is kept inside the mouth,
    // so a big tongue flattens against the lip instead of poking out of a narrow or closed mouth.
    const tongueY = topEdge(0, mouthSmile, mouthSkew) - DEPTH * open * TONGUE_DROP
    const tPos = tongue.geometry.attributes.position
    for (let i = 0; i < tPos.count; i++) {
      const u = THREE.MathUtils.clamp((tongue.rest[i * 3] * TONGUE_RX) / HALF_WIDTH, -0.95, 0.95)
      const x = u * halfWidth
      const lo = bottomEdge(u, open, mouthSmile, mouthSkew) + 0.012
      const hi = topEdge(u, mouthSmile, mouthSkew) - 0.012
      const y = THREE.MathUtils.clamp(tongueY + tongue.rest[i * 3 + 1] * TONGUE_RY * open, lo, Math.max(lo, hi))
      tPos.setXYZ(i, x, y, surfaceZ(x, MOUTH_Y + y) + TONGUE_GAP)
    }
    tPos.needsUpdate = true

    // Teeth hang from the top edge, shorter when the mouth is nearly shut so they never poke out below it.
    const toothScale = Math.min(1, open * 1.6)
    const teeth = teethRef.current?.children
    if (!teeth) return
    for (let i = 0; i < teeth.length; i++) {
      const tooth = teeth[i]
      const u = (-1 + (2 * (i + 0.5)) / TOOTH_COUNT) * TEETH_SPAN
      const x = u * halfWidth
      const height = toothScale * TOOTH_HEIGHTS[i % TOOTH_HEIGHTS.length]
      const y = topEdge(u, mouthSmile, mouthSkew) - (TOOTH_SIZE[1] * height) / 2
      const z = surfaceZ(x, MOUTH_Y + y) + TOOTH_GAP
      tooth.position.set(x, y, z)
      tooth.rotation.y = Math.atan2(x, z) // face outward along the curved surface
      tooth.scale.set(mouthWidth, height, 1)
    }
  })

  return (
    <group position={[0, MOUTH_Y, 0]}>
      {/* Culling is off because the vertices move every frame and the cached bounds would go stale. */}
      <mesh geometry={interior} material={materials.mouth} frustumCulled={false} />
      <mesh geometry={tongue.geometry} material={materials.tongue} frustumCulled={false} />
      <group ref={teethRef}>
        {Array.from({ length: TOOTH_COUNT }, (_, i) => (
          <mesh key={i} geometry={toothGeometry} material={materials.teeth}>
            <Outlines thickness={TOOTH_OUTLINE} color={OUTLINE_COLOR} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
