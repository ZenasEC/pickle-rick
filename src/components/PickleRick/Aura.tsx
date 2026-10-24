// Super Saiyan Dragon Ball Z energy aura for Pickle Rick:
// - Back Aura: massive dense envelope of sharp animated flame spires fanning up and out
// - Front Aura: flame tongues rising over the legs and lower belly (additive 3D envelopment)
// - Lightning Arcs: 6 dual-layer electric sparks (cyan glow + pure white core) crackling around flanks
// - Ground Glow: massive radial golden pool of light on the floor under the feet
// - Point Light: brilliant warm golden radiance illuminating Pickle Rick and the laboratory
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BODY_BOTTOM_X } from './bodyShape'
import { GROUND_Y } from './limbs/limbConfig'
import type { CharacterState } from './animation/characterState'
import { RING_COUNT, RING_LIFE } from './animation/auraLayer'
import {
  boltPoints,
  buildSuperSaiyanSpires,
  createGroundGlowCanvas,
  createSpireIndex,
  writeBolt,
  writeSpireGeometry,
} from './FlameShape'

// Lightning specs around the aura perimeter
interface BoltSpec {
  pos: [number, number, number]
  from: [number, number]
  to: [number, number]
  cyanWidth: number
  whiteWidth: number
}

const LIGHTNING_SPECS: BoltSpec[] = [
  // Left upper (shoulder / head level)
  { pos: [-0.65, 0.4, 0.3], from: [0.1, -0.2], to: [-0.6, 1.1], cyanWidth: 0.08, whiteWidth: 0.035 },
  // Left mid (waist level)
  { pos: [-0.85, -0.3, 0.35], from: [0.2, -0.4], to: [-0.55, 0.6], cyanWidth: 0.08, whiteWidth: 0.035 },
  // Left lower (legs / hip level)
  { pos: [-0.5, -1.0, 0.25], from: [0.1, -0.4], to: [-0.4, 0.4], cyanWidth: 0.07, whiteWidth: 0.03 },
  // Right upper (shoulder / head level)
  { pos: [0.65, 0.4, 0.3], from: [-0.1, -0.2], to: [0.6, 1.1], cyanWidth: 0.08, whiteWidth: 0.035 },
  // Right mid (waist level)
  { pos: [0.85, -0.3, 0.35], from: [-0.2, -0.4], to: [0.55, 0.6], cyanWidth: 0.08, whiteWidth: 0.035 },
  // Right lower (legs / hip level)
  { pos: [0.5, -1.0, 0.25], from: [-0.1, -0.4], to: [0.4, 0.4], cyanWidth: 0.07, whiteWidth: 0.03 },
]

const BOLT_SEGS = 7
const BOLT_JITTER = 0.16

/** Main Super Saiyan aura surrounding Pickle Rick */
export function AuraShell({ stateRef, reducedMotion = false }: { stateRef: RefObject<CharacterState>; reducedMotion?: boolean }) {
  const { back: backDefs, front: frontDefs } = useMemo(buildSuperSaiyanSpires, [])

  // 1. Back Aura Buffer Geometry
  const backGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(backDefs.length * 5 * 3)
    const col = new Float32Array(backDefs.length * 5 * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setIndex(createSpireIndex(backDefs.length))
    return geo
  }, [backDefs])

  // 2. Front Aura Buffer Geometry
  const frontGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(frontDefs.length * 5 * 3)
    const col = new Float32Array(frontDefs.length * 5 * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setIndex(createSpireIndex(frontDefs.length))
    return geo
  }, [frontDefs])

  // Materials with Additive Blending and Vertex Colors
  const backMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  )

  const frontMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  )

  // 3. Lightning Meshes (Cyan glow outer ribbon + White core inner ribbon)
  const cyanBoltMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#00e5ff',
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  )

  const whiteBoltMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  )

  const lightningBolts = useMemo(
    () =>
      LIGHTNING_SPECS.map((spec, bi) => {
        const verts = BOLT_SEGS + 1
        const cyanPos = new Float32Array(verts * 2 * 3)
        const whitePos = new Float32Array(verts * 2 * 3)
        const indices: number[] = []
        for (let i = 0; i < BOLT_SEGS; i++) {
          const a = i * 2
          indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3)
        }

        const cyanGeo = new THREE.BufferGeometry()
        const cyanAttr = new THREE.BufferAttribute(cyanPos, 3).setUsage(THREE.DynamicDrawUsage)
        cyanGeo.setAttribute('position', cyanAttr)
        cyanGeo.setIndex(indices)

        const whiteGeo = new THREE.BufferGeometry()
        const whiteAttr = new THREE.BufferAttribute(whitePos, 3).setUsage(THREE.DynamicDrawUsage)
        whiteGeo.setAttribute('position', whiteAttr)
        whiteGeo.setIndex(indices)

        const initialPts = boltPoints(500 + bi * 333, spec, BOLT_SEGS, BOLT_JITTER)
        writeBolt(cyanPos, initialPts, spec.cyanWidth)
        writeBolt(whitePos, initialPts, spec.whiteWidth)
        cyanAttr.needsUpdate = true
        whiteAttr.needsUpdate = true

        return { spec, cyanGeo, cyanAttr, whiteGeo, whiteAttr, nextRegen: 0 }
      }),
    [],
  )

  const light = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    const live = !reducedMotion
    const t = live ? clock.elapsedTime : 0
    const a = stateRef.current.aura

    // Roar factor: surges on excitement, hops, and throws
    const roar = 1.0 + a.glow * 0.25 + a.flash * 0.65

    // 1. Update Back Spire Vertices
    const backPos = backGeo.attributes.position.array as Float32Array
    const backCol = backGeo.attributes.color.array as Float32Array
    writeSpireGeometry(backPos, backCol, backDefs, t, roar, a.color)
    backGeo.attributes.position.needsUpdate = true
    backGeo.attributes.color.needsUpdate = true

    // 2. Update Front Spire Vertices
    const frontPos = frontGeo.attributes.position.array as Float32Array
    const frontCol = frontGeo.attributes.color.array as Float32Array
    writeSpireGeometry(frontPos, frontCol, frontDefs, t, roar, a.color)
    frontGeo.attributes.position.needsUpdate = true
    frontGeo.attributes.color.needsUpdate = true

    // 3. Lightning Regenerations (Rapid electric crackle)
    for (const bolt of lightningBolts) {
      if (live && t >= bolt.nextRegen) {
        const seed = (Math.random() * 1e8) | 0
        const pts = boltPoints(seed, bolt.spec, BOLT_SEGS, BOLT_JITTER)
        writeBolt(bolt.cyanAttr.array as Float32Array, pts, bolt.spec.cyanWidth)
        writeBolt(bolt.whiteAttr.array as Float32Array, pts, bolt.spec.whiteWidth)
        bolt.cyanAttr.needsUpdate = true
        bolt.whiteAttr.needsUpdate = true
        // Stagger next zap between 60ms and 140ms
        bolt.nextRegen = t + 0.06 + Math.random() * 0.08
      }
    }

    // 4. Brilliant Golden Aura Point Light
    if (light.current) {
      // Golden radiance casting light on the body and environment
      light.current.intensity = (7 + a.glow * 8 + a.flash * 14) * roar
      light.current.color.setRGB(a.color.r, a.color.g * 0.9, a.color.b * 0.3)
    }
  })

  return (
    <group name="SuperSaiyanAura">
      {/* 1. Back Aura: massive dense golden inferno behind Pickle Rick */}
      <mesh
        name="AuraBackFlames"
        geometry={backGeo}
        material={backMat}
        position={[0, 0, -0.15]}
        frustumCulled={false}
      />

      {/* 2. Front Aura: rising flame teeth in front of legs and belly */}
      <mesh
        name="AuraFrontFlames"
        geometry={frontGeo}
        material={frontMat}
        position={[0, 0, 0.22]}
        frustumCulled={false}
      />

      {/* 3. Electric Lightning Sparks */}
      {lightningBolts.map((b, i) => (
        <group key={i} position={b.spec.pos}>
          {/* Cyan glow ribbon */}
          <mesh geometry={b.cyanGeo} material={cyanBoltMat} frustumCulled={false} />
          {/* White core ribbon */}
          <mesh geometry={b.whiteGeo} material={whiteBoltMat} position={[0, 0, 0.01]} frustumCulled={false} />
        </group>
      ))}

      {/* 4. Golden Aura Point Light */}
      <pointLight
        ref={light}
        name="AuraPointLight"
        color="#ffe84d"
        distance={15}
        decay={1.2}
        position={[0, 0.2, 1.2]}
      />
    </group>
  )
}

/** Massive radial golden light pool on the floor beneath Pickle Rick */
export function AuraGround({ stateRef }: { stateRef: RefObject<CharacterState> }) {
  // Smooth radial glow texture generated on an HTML canvas
  const glowTexture = useMemo(() => {
    if (typeof document === 'undefined') return null
    const canvas = createGroundGlowCanvas()
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
  }, [])

  const poolMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: glowTexture,
        color: '#ffdf33',
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [glowTexture],
  )

  const ringMats = useMemo(
    () =>
      Array.from(
        { length: RING_COUNT },
        () =>
          new THREE.MeshBasicMaterial({
            color: '#ffe540',
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
      ),
    [],
  )

  const poolMesh = useRef<THREE.Mesh>(null)
  const ringMeshes = useRef<(THREE.Mesh | null)[]>([])

  useFrame(() => {
    const s = stateRef.current
    const a = s.aura

    // Pool follows the character's throw position
    if (poolMesh.current) {
      poolMesh.current.position.set(BODY_BOTTOM_X + s.drag.x, GROUND_Y + 0.003, 0.05)
      poolMat.opacity = 0.5 + a.glow * 0.15 + a.flash * 0.2
      poolMat.color.setRGB(a.color.r, a.color.g, a.color.b * 0.4)
    }

    // Impact / Hop shockwave rings
    for (let i = 0; i < RING_COUNT; i++) {
      const r = a.rings[i]
      const mesh = ringMeshes.current[i]
      if (!mesh) continue
      mesh.visible = r.active
      if (!r.active) continue
      const k = r.age / RING_LIFE
      const sc = 0.8 + k * 3.5
      mesh.scale.set(sc, sc, 1)
      mesh.position.x = BODY_BOTTOM_X + r.x
      const m = ringMats[i]
      m.opacity = (1 - k) * 0.8
      m.color.setRGB(a.color.r, a.color.g, a.color.b * 0.4)
    }
  })

  return (
    <group name="AuraGroundEffects">
      {/* 1. Large glowing golden puddle on the floor */}
      <mesh
        ref={poolMesh}
        name="AuraGroundPool"
        material={poolMat}
        position={[BODY_BOTTOM_X, GROUND_Y + 0.003, 0.05]}
        rotation-x={-Math.PI / 2}
      >
        <planeGeometry args={[4.4, 4.4]} />
      </mesh>

      {/* 2. Shockwave shock rings */}
      {ringMats.map((m, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            ringMeshes.current[i] = mesh
          }}
          name={`AuraShockRing${i}`}
          material={m}
          visible={false}
          position={[BODY_BOTTOM_X, GROUND_Y + 0.004, 0.05]}
          rotation-x={-Math.PI / 2}
        >
          <ringGeometry args={[0.55, 0.68, 48]} />
        </mesh>
      ))}
    </group>
  )
}
