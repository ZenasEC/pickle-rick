// The cartoon laboratory around the character: floor, back wall and simple procedural props
// (workbench with a bubbling flask, shelf with bottles, crates, hanging lamp, atom poster, pipes).
// Everything is Three.js primitives + shared toon materials: no models, images or textures.
// Props sit outside the drag area (|x| > 2.8) or behind the character (z < 0), so playing
// with the pickle never visually collides with the furniture. Only the flask bubbles move,
// and they freeze when reduced motion is on.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Outlines } from '@react-three/drei'
import * as THREE from 'three'
import { GROUND_Y } from '../components/PickleRick/limbs/limbConfig'
import { OUTLINE_COLOR, labMaterials } from '../components/PickleRick/materials'

const WALL_Z = -3.2 // back wall depth: far enough for parallax, close enough to stay in frame
const OUTLINE_PROP = 0.015 // thin cartoon line for furniture

/**
 * Pure math for the flask bubbles: loops 0..max as time passes, so each bubble rises
 * through the liquid and restarts at the bottom. Exported for unit tests.
 */
export function bubbleHeight(t: number, speed: number, offset: number, max: number): number {
  return ((((t * speed + offset) % max) + max) % max)
}

export default function Laboratory({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <group name="Laboratory">
      <Room />
      <Bench />
      <Bubbles reducedMotion={reducedMotion} />
      <Shelf />
      <Crates />
      <Lamp />
      <Poster />
      <Pipes />
    </group>
  )
}

/** Floor, back wall, baseboard and a darker mat anchoring the play area. */
function Room() {
  return (
    <group>
      {/* Floor: big enough to cover every desktop aspect ratio, top edge hidden behind the wall. */}
      <mesh material={labMaterials.floor} position={[0, GROUND_Y, -4]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[30, 30]} />
      </mesh>
      {/* Dark mat under the character: marks the play area, like a rug. */}
      <mesh material={labMaterials.mat} position={[0, GROUND_Y + 0.002, 0.3]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.5, 40]} />
      </mesh>
      {/* Back wall: spans from the floor up out of frame. */}
      <mesh material={labMaterials.wall} position={[0, GROUND_Y + 4.5, WALL_Z]}>
        <planeGeometry args={[24, 9]} />
      </mesh>
      {/* Baseboard: the strip where wall meets floor, sells the room corner. */}
      <mesh material={labMaterials.baseboard} position={[0, GROUND_Y + 0.12, WALL_Z + 0.05]}>
        <boxGeometry args={[24, 0.24, 0.1]} />
      </mesh>
    </group>
  )
}

/** Workbench on the left with bottles on top. The flask is added separately (see Flask + Bubbles). */
function Bench() {
  const topY = 1.0 // local height of the tabletop; group sits on the floor
  return (
    <group name="Bench" position={[-3.4, GROUND_Y, -1.6]}>
      <mesh material={labMaterials.wood} position={[0, topY, 0]}>
        <boxGeometry args={[1.7, 0.12, 0.85]} />
        <Outlines thickness={OUTLINE_PROP} color={OUTLINE_COLOR} />
      </mesh>
      {/* Lower shelf between the legs. */}
      <mesh material={labMaterials.woodDark} position={[0, 0.35, 0]}>
        <boxGeometry args={[1.4, 0.08, 0.7]} />
      </mesh>
      {[-0.75, 0.75].map((x) =>
        [-0.32, 0.32].map((z) => (
          <mesh key={`${x}${z}`} material={labMaterials.woodDark} position={[x, topY / 2, z]}>
            <boxGeometry args={[0.1, topY, 0.1]} />
          </mesh>
        )),
      )}
      {/* Bottles waiting on the bench. */}
      <Bottle position={[-0.55, topY + 0.06, 0.1]} height={0.34} radius={0.09} material={labMaterials.bottleAmber} />
      <Bottle position={[-0.2, topY + 0.06, -0.15]} height={0.26} radius={0.07} material={labMaterials.bottleBlue} />
      <Flask position={[0.4, topY + 0.06, 0.05]} />
    </group>
  )
}

/** A small bottle: body + neck + cap, sitting on y=0 of its position. */
function Bottle({
  position, height, radius, material,
}: {
  position: [number, number, number]
  height: number
  radius: number
  material: THREE.Material
}) {
  return (
    <group position={position}>
      <mesh material={material} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[radius, radius, height, 14]} />
        <Outlines thickness={OUTLINE_PROP} color={OUTLINE_COLOR} />
      </mesh>
      <mesh material={material} position={[0, height + 0.05, 0]}>
        <cylinderGeometry args={[radius * 0.4, radius * 0.4, 0.12, 10]} />
      </mesh>
      <mesh material={labMaterials.frame} position={[0, height + 0.12, 0]}>
        <cylinderGeometry args={[radius * 0.45, radius * 0.45, 0.05, 10]} />
      </mesh>
    </group>
  )
}

/** Erlenmeyer flask: transparent cone over opaque glowing liquid. Bubbles live in <Bubbles/>. */
function Flask({ position }: { position: [number, number, number] }) {
  return (
    <group name="Flask" position={position}>
      <mesh material={labMaterials.liquid} position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.07, 0.2, 0.26, 16]} />
      </mesh>
      <mesh material={labMaterials.glass} position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.09, 0.26, 0.4, 16]} />
        <Outlines thickness={OUTLINE_PROP} color={OUTLINE_COLOR} />
      </mesh>
      <mesh material={labMaterials.glass} position={[0, 0.47, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.16, 12]} />
      </mesh>
    </group>
  )
}

/** Three bubbles looping upward through the flask liquid. Positions match <Flask/> above. */
function Bubbles({ reducedMotion }: { reducedMotion: boolean }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  // Fixed x/z per bubble so they don't wander; y is rewritten every frame.
  const seeds = useMemo(
    () => [
      { x: -0.06, z: 0.02, offset: 0 },
      { x: 0.06, z: -0.03, offset: 0.12 },
      { x: 0.01, z: 0.06, offset: 0.22 },
    ],
    [],
  )
  useFrame(({ clock }) => {
    // Frozen under reduced motion: t = 0 parks every bubble at its start height.
    const t = reducedMotion ? 0 : clock.elapsedTime
    for (let i = 0; i < seeds.length; i++) {
      const m = meshes.current[i]
      if (m) m.position.set(seeds[i].x, 0.05 + bubbleHeight(t, 0.18, seeds[i].offset, 0.24), seeds[i].z)
    }
  })
  return (
    <group name="FlaskBubbles" position={[-3.0, GROUND_Y + 1.06, -1.55]}>
      {seeds.map((s, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m
          }}
          material={labMaterials.bubble}
          position={[s.x, 0.05, s.z]}
        >
          <sphereGeometry args={[0.028, 10, 8]} />
        </mesh>
      ))}
    </group>
  )
}

/** Wall shelf on the right with three more bottles. */
function Shelf() {
  const y = 1.3
  return (
    <group name="Shelf" position={[2.7, y, -2.9]}>
      <mesh material={labMaterials.wood} position={[0, 0, 0]}>
        <boxGeometry args={[1.8, 0.1, 0.5]} />
        <Outlines thickness={OUTLINE_PROP} color={OUTLINE_COLOR} />
      </mesh>
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} material={labMaterials.woodDark} position={[x, -0.18, -0.1]}>
          <boxGeometry args={[0.08, 0.3, 0.3]} />
        </mesh>
      ))}
      <Bottle position={[-0.55, 0.05, 0]} height={0.3} radius={0.08} material={labMaterials.bottleBlue} />
      <Bottle position={[-0.05, 0.05, 0.05]} height={0.38} radius={0.09} material={labMaterials.bottleRed} />
      <Bottle position={[0.5, 0.05, -0.05]} height={0.26} radius={0.07} material={labMaterials.bottleAmber} />
    </group>
  )
}

/** Two stacked crates on the right: supply boxes, slightly turned for a casual look. */
function Crates() {
  return (
    <group name="Crates" position={[3.3, GROUND_Y, -1.2]} rotation-y={-0.25}>
      <mesh material={labMaterials.crate} position={[0, 0.45, 0]}>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <Outlines thickness={OUTLINE_PROP} color={OUTLINE_COLOR} />
      </mesh>
      <mesh material={labMaterials.crate} position={[-0.1, 1.2, 0.05]} rotation-y={0.35}>
        <boxGeometry args={[0.65, 0.65, 0.65]} />
        <Outlines thickness={OUTLINE_PROP} color={OUTLINE_COLOR} />
      </mesh>
    </group>
  )
}

/** Hanging lamp: cord out of frame, cone shade, warm glowing bulb (unlit material, no real light). */
function Lamp() {
  return (
    <group name="Lamp" position={[1.6, 0, -1.5]}>
      <mesh material={labMaterials.frame} position={[0, 3.4, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 2.2, 8]} />
      </mesh>
      <mesh material={labMaterials.shade} position={[0, 2.25, 0]}>
        <cylinderGeometry args={[0.08, 0.45, 0.4, 18]} />
        <Outlines thickness={OUTLINE_PROP} color={OUTLINE_COLOR} />
      </mesh>
      <mesh material={labMaterials.bulb} position={[0, 2.08, 0]}>
        <sphereGeometry args={[0.09, 12, 10]} />
      </mesh>
    </group>
  )
}

/** Framed science poster: paper + three orbit rings around a nucleus, all primitives. */
function Poster() {
  return (
    <group name="Poster" position={[-2.1, 1.5, WALL_Z + 0.04]}>
      <mesh material={labMaterials.frame} position={[0, 0, 0]}>
        <boxGeometry args={[1.2, 1.5, 0.06]} />
      </mesh>
      <mesh material={labMaterials.paper} position={[0, 0, 0.035]}>
        <planeGeometry args={[1.0, 1.3]} />
      </mesh>
      <group position={[0, 0, 0.06]}>
        <mesh material={labMaterials.bottleRed}>
          <sphereGeometry args={[0.09, 12, 10]} />
        </mesh>
        {/* Three orbit rings tilted apart: the classic atom doodle. */}
        <mesh material={labMaterials.bottleBlue} rotation-x={Math.PI / 2.4}>
          <torusGeometry args={[0.32, 0.02, 8, 32]} />
        </mesh>
        <mesh material={labMaterials.bottleAmber} rotation-x={Math.PI / 2.4} rotation-y={(2 * Math.PI) / 3}>
          <torusGeometry args={[0.32, 0.02, 8, 32]} />
        </mesh>
        <mesh material={labMaterials.shade} rotation-x={Math.PI / 2.4} rotation-y={-(2 * Math.PI) / 3}>
          <torusGeometry args={[0.32, 0.02, 8, 32]} />
        </mesh>
      </group>
    </group>
  )
}

/** Wall pipes: two horizontal runs plus a vertical drop, plain metal cylinders. */
function Pipes() {
  return (
    <group name="Pipes">
      <mesh material={labMaterials.metal} position={[0, 2.9, WALL_Z + 0.18]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.09, 0.09, 22, 12]} />
      </mesh>
      <mesh material={labMaterials.metal} position={[0, 2.6, WALL_Z + 0.15]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.06, 0.06, 22, 10]} />
      </mesh>
      <mesh material={labMaterials.metal} position={[4.6, GROUND_Y + 2.3, WALL_Z + 0.18]}>
        <cylinderGeometry args={[0.09, 0.09, 4.6, 12]} />
      </mesh>
    </group>
  )
}
