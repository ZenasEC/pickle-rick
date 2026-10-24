'use client'
// The 3D scene: canvas, camera, lights and the character. 'use client' because WebGL only exists in the browser.
import { useEffect, useState, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import PickleRick from '../components/PickleRick/PickleRick'
import ExpressionPicker from '../components/ExpressionPicker'
import { EXPRESSION_NAMES, type ExpressionName } from '../components/PickleRick/ExpressionController'
import Laboratory from './Laboratory'
import { BASE_DISTANCE, CAMERA_FOV, fitDistance } from './viewport'
import { loadMuted, playClick, saveMuted, setMuted as setSfxMuted } from '../audio/sfx'
import { useMousePosition, type PointerState } from '../hooks/useMousePosition'

const AURA_KEY = 'pickle-aura'

/** Aura defaults to on; choice survives reloads. Guarded for server rendering and private mode. */
function loadAuraOn(): boolean {
  try {
    return typeof window === 'undefined' || window.localStorage.getItem(AURA_KEY) !== '0'
  } catch {
    return true
  }
}

function saveAuraOn(on: boolean): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(AURA_KEY, on ? '1' : '0')
  } catch {
    // private mode: remembering is not required
  }
}

const CAMERA_POSITION: [number, number, number] = [0, -0.05, BASE_DISTANCE] // pulled back to fit the legs
const LOOK_AT = new THREE.Vector3(0, -0.2, 0)
const CAMERA_PARALLAX = 0.25 // max camera drift toward the pointer, in world units
const CAMERA_DAMPING = 2.5 // low = floaty, high = stiff

/** Drifts the camera slightly toward the pointer and always looks at the character. No user camera controls. */
function CameraRig({ pointer, reducedMotion }: { pointer: RefObject<PointerState>; reducedMotion: boolean }) {
  useFrame(({ camera, size }, delta) => {
    const p = pointer.current
    const follow = p.active && !reducedMotion ? CAMERA_PARALLAX : 0
    const tx = CAMERA_POSITION[0] + p.x * follow
    const ty = CAMERA_POSITION[1] + p.y * follow
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tx, CAMERA_DAMPING, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, ty, CAMERA_DAMPING, delta)
    // Portrait phones: dolly out until the character fits. Damped, so rotating the phone is a
    // smooth glide. Kept under reduced motion too, otherwise the character would stay cropped.
    const aspect = size.width / Math.max(size.height, 1)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, fitDistance(aspect), CAMERA_DAMPING, delta)
    camera.lookAt(LOOK_AT)
  })
  return null
}

export default function MainScene() {
  const pointer = useMousePosition()
  const [reducedMotion, setReducedMotion] = useState(false)
  const [expression, setExpression] = useState<ExpressionName>('idle')
  const [muted, setMutedState] = useState<boolean>(() => loadMuted())
  const [auraOn, setAuraOn] = useState<boolean>(() => loadAuraOn())

  useEffect(() => {
    setReducedMotion(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  }, [])

  // Engine follows the toggle, and the choice survives reloads.
  useEffect(() => {
    setSfxMuted(muted)
    saveMuted(muted)
  }, [muted])

  // Aura choice survives reloads too.
  useEffect(() => {
    saveAuraOn(auraOn)
  }, [auraOn])

  const changeExpression = (name: ExpressionName) => {
    playClick()
    setExpression(name)
  }

  // Keys 1-6 pick an expression, in the same order as the buttons. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const i = Number(e.key) - 1
      if (Number.isInteger(i) && i >= 0 && i < EXPRESSION_NAMES.length) changeExpression(EXPRESSION_NAMES[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="scene">
      <Canvas
        dpr={[1, 2]}
        flat // no tone mapping: keeps the cartoon colors exactly as written
        fallback={<p className="fallback">Your browser could not start WebGL, so the 3D pickle cannot be shown.</p>}
      >
        <PerspectiveCamera makeDefault fov={CAMERA_FOV} position={CAMERA_POSITION} />
        <CameraRig pointer={pointer} reducedMotion={reducedMotion} />

        {/* Cel lighting: one warm key light makes the hard shadow shape; a cool ambient sets the shadow color.
            No rim light: with toon shading it would brighten every surface and wash the shadows out. */}
        <ambientLight intensity={1.35} color="#cfe3f2" />
        <directionalLight position={[3.5, 4, 4]} intensity={2.1} color="#fff3dc" />

        {/* Base mood; cursor reactions and holding still override it for a moment. */}
        <Laboratory reducedMotion={reducedMotion} />
        <PickleRick expression={expression} pointer={pointer} reducedMotion={reducedMotion} auraOn={auraOn} />
      </Canvas>
      <ExpressionPicker
        value={expression}
        onChange={changeExpression}
        muted={muted}
        onToggleMute={() => setMutedState((m) => !m)}
        auraOn={auraOn}
        onToggleAura={() => setAuraOn((on) => !on)}
      />
    </div>
  )
}
