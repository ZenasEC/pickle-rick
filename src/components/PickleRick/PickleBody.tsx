// The pickle body mesh: a 2D outline spun around the Y axis (LatheGeometry), made lumpy, bent
// slightly like a real pickle, and colored with mixed greens. The shape math is in bodyShape.ts.
import { useMemo } from 'react'
import { Outlines } from '@react-three/drei'
import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { materials, OUTLINE_COLOR, PICKLE_GREEN_DARK, PICKLE_GREEN_LIGHT } from './materials'
import { bendX, lump, PROFILE, surfacePoint, surfaceRadius } from './bodyShape'

const RADIAL_SEGMENTS = 48 // enough to show the lengthwise stripes without faceting
const PROFILE_SAMPLES = 40 // 40 x 48 ≈ 3,800 triangles
const OUTLINE_THICKNESS = 0.042

// Warts. phi = angle around the body (0 = front, positive = screen right).
const BUMPS: { y: number; phi: number; size: number }[] = [
  { y: -0.7, phi: 1.4, size: 1 }, { y: -0.2, phi: 1.9, size: 0.8 }, { y: 0.5, phi: 1.6, size: 0.9 },
  { y: -0.9, phi: -1.5, size: 0.9 }, { y: 0.1, phi: -1.7, size: 1 }, { y: 0.7, phi: -2.0, size: 0.7 },
  { y: -0.4, phi: 3.0, size: 1 }, { y: 0.3, phi: 2.6, size: 0.8 },
  // Front and top, away from the face, so the visible side isn't smooth like a toy.
  { y: -0.55, phi: 0.3, size: 1.1 }, { y: -0.95, phi: -0.35, size: 0.9 }, { y: -0.25, phi: -0.55, size: 0.8 },
  { y: -0.75, phi: 0.95, size: 0.9 }, { y: -1.15, phi: 0.6, size: 0.8 }, { y: 1.22, phi: 0.45, size: 0.8 },
  { y: 1.18, phi: -1.3, size: 0.9 },
]

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
      {BUMPS.map(({ y, phi, size }, i) => (
        <mesh
          key={i}
          geometry={bumpGeometry}
          material={materials.bump}
          position={surfacePoint(y, phi, 0.005)}
          // Turned to face outward and flattened against the skin, so they read as warts, not beads.
          rotation-y={phi}
          scale={[size, size * 1.3, size * 0.6]}
        />
      ))}
    </group>
  )
}
