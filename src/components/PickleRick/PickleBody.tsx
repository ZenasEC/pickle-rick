// The pickle body: a 2D outline spun around the Y axis (LatheGeometry), made lumpy with a
// fixed sum of sine waves, bent slightly like a real pickle, and colored with mixed greens.
// Also exports surfaceZ() so face parts can sit exactly on the lumpy, bent surface.
import { useMemo } from 'react'
import { Outlines } from '@react-three/drei'
import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { materials, OUTLINE_COLOR, PICKLE_GREEN_DARK, PICKLE_GREEN_LIGHT } from './materials'

// Body outline as [radius, height] pairs, bottom to top. Widest around the face, tapering
// toward a blunt bottom, with a broad flattish dome on top. Edit these to reshape the pickle.
const PROFILE: [number, number][] = [
  [0, -1.36], [0.2, -1.33], [0.34, -1.24], [0.44, -1.08], [0.5, -0.8], [0.53, -0.4], [0.555, 0],
  [0.57, 0.4], [0.565, 0.75], [0.53, 1.02], [0.44, 1.24], [0.28, 1.39], [0, 1.44],
]
/** Y of the lowest point of the body: the character's feet, used to keep them on the ground when squashing. */
export const BODY_BOTTOM_Y = PROFILE[0][1]
const MAX_RADIUS = 0.57
const RADIAL_SEGMENTS = 48 // enough to show the lengthwise stripes without faceting
const PROFILE_SAMPLES = 40 // 40 x 48 ≈ 3,800 triangles
const OUTLINE_THICKNESS = 0.042

// Below BEND_START the body curves sideways (more toward the bottom), so it is not a straight capsule.
// The face area stays practically unbent, and surfaceZ() accounts for the bend anyway.
const BEND = 0.035
const BEND_START = 0.1
const bendX = (y: number) => BEND * Math.max(0, BEND_START - y) ** 2
/** X of the lowest point of the body after bending: the shadow sits under it. */
export const BODY_BOTTOM_X = bendX(BODY_BOTTOM_Y)

// Warts. phi = angle around the body (0 = front, positive = character's left... i.e. screen right).
const BUMPS: { y: number; phi: number; size: number }[] = [
  { y: -0.7, phi: 1.4, size: 1 }, { y: -0.2, phi: 1.9, size: 0.8 }, { y: 0.5, phi: 1.6, size: 0.9 },
  { y: -0.9, phi: -1.5, size: 0.9 }, { y: 0.1, phi: -1.7, size: 1 }, { y: 0.7, phi: -2.0, size: 0.7 },
  { y: -0.4, phi: 3.0, size: 1 }, { y: 0.3, phi: 2.6, size: 0.8 },
  // Front and top, away from the face, so the visible side isn't smooth like a toy.
  { y: -0.55, phi: 0.3, size: 1.1 }, { y: -0.95, phi: -0.35, size: 0.9 }, { y: -0.25, phi: -0.55, size: 0.8 },
  { y: -0.75, phi: 0.95, size: 0.9 }, { y: -1.15, phi: 0.6, size: 0.8 }, { y: 1.22, phi: 0.45, size: 0.8 },
  { y: 1.18, phi: -1.3, size: 0.9 },
]

/** Radius of the smooth outline at height y (straight-line interpolation between PROFILE points). */
function profileRadius(y: number): number {
  for (let i = 1; i < PROFILE.length; i++) {
    const [r0, y0] = PROFILE[i - 1]
    const [r1, y1] = PROFILE[i]
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0)
  }
  return 0
}

/** Deterministic lumpiness: same every reload, no noise library needed. phi = angle around Y (0 = front). */
function lump(phi: number, y: number): number {
  return (
    0.024 * Math.sin(3 * phi + y * 2.1) +
    0.014 * Math.sin(5 * phi - y * 3.7) +
    0.008 * Math.sin(y * 6.3) +
    0.006 * Math.sin(8 * phi + y * 1.7 + 0.5)
  )
}

/** Radius of the lumpy surface at height y and angle phi. Lumps fade to 0 at the tips so the poles stay closed. */
function surfaceRadius(y: number, phi: number): number {
  const r = profileRadius(y)
  return r + lump(phi, y) * (r / MAX_RADIUS)
}

/** Z of the front surface at (x, y). Face parts use this to sit on the body instead of floating or sinking. */
export function surfaceZ(x: number, y: number): number {
  const xl = x - bendX(y)
  const phi = Math.asin(THREE.MathUtils.clamp(xl / Math.max(profileRadius(y), 1e-3), -1, 1))
  const r = surfaceRadius(y, phi)
  return Math.sqrt(Math.max(r * r - xl * xl, 0))
}

/** 0..1 mix between the dark and light green at a point on the body. */
function greenMix(phi: number, y: number): number {
  const bumps = lump(phi, y) * 8 // lumps lighter, dips darker
  const stripes = 0.09 * Math.sin(8 * phi + 0.8 * Math.sin(1.7 * y)) // faint lengthwise pickle stripes
  const blotches = 0.08 * Math.sin(2 * phi + 1.3 * y + 1)
  return THREE.MathUtils.clamp(0.55 + bumps + stripes + blotches + y * 0.14, 0, 1) // darker toward the bottom
}

function createBodyGeometry(): THREE.BufferGeometry {
  // A spline through the profile points gives a smooth outline instead of visible corners.
  const points = new THREE.SplineCurve(PROFILE.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(PROFILE_SAMPLES)
  points[0].x = 0 // keep the tips exactly on the axis so the lathe closes
  points[points.length - 1].x = 0
  // phiStart = PI puts the lathe seam at the back, away from the face.
  let geometry: THREE.BufferGeometry = new THREE.LatheGeometry(points, RADIAL_SEGMENTS, Math.PI)
  // Drop normals/uvs and weld the seam so lighting and outlines are smooth all the way round.
  geometry.deleteAttribute('normal')
  geometry.deleteAttribute('uv')
  geometry = mergeVertices(geometry)

  const pos = geometry.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const color = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i)
    const y = pos.getY(i)
    let z = pos.getZ(i)
    const r = Math.hypot(x, z)
    const phi = Math.atan2(x, z)
    if (r > 1e-5) {
      const k = surfaceRadius(y, phi) / r
      x *= k
      z *= k
    }
    pos.setXYZ(i, x + bendX(y), y, z)
    color.copy(PICKLE_GREEN_DARK).lerp(PICKLE_GREEN_LIGHT, greenMix(phi, y))
    colors.set([color.r, color.g, color.b], i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

/** The body is static; breathing and squash are applied to its parent group (see useCharacterAnimation). */
export default function PickleBody() {
  const geometry = useMemo(createBodyGeometry, [])
  const bumpGeometry = useMemo(() => new THREE.IcosahedronGeometry(0.045, 1), [])

  return (
    <group>
      <mesh geometry={geometry} material={materials.body}>
        <Outlines thickness={OUTLINE_THICKNESS} color={OUTLINE_COLOR} />
      </mesh>
      {BUMPS.map(({ y, phi, size }, i) => {
        const r = surfaceRadius(y, phi) - 0.005
        return (
          <mesh
            key={i}
            geometry={bumpGeometry}
            material={materials.bump}
            position={[r * Math.sin(phi) + bendX(y), y, r * Math.cos(phi)]}
            // Turned to face outward and flattened against the skin, so they read as warts, not beads.
            rotation-y={phi}
            scale={[size, size * 1.3, size * 0.6]}
          />
        )
      })}
    </group>
  )
}
