'use client'
// The 3D scene: canvas, camera, lights and the character. 'use client' because WebGL only exists in the browser.
import { useEffect, useState, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import PickleRick from '../components/PickleRick/PickleRick'
import { useMousePosition, type PointerState } from '../hooks/useMousePosition'

const CAMERA_POSITION: [number, number, number] = [0, 0.15, 6.5]
const LOOK_AT = new THREE.Vector3(0, 0.05, 0)
const CAMERA_PARALLAX = 0.25 // max camera drift toward the pointer, in world units
const CAMERA_DAMPING = 2.5 // low = floaty, high = stiff

/** Drifts the camera slightly toward the pointer and always looks at the character. No user camera controls. */
function CameraRig({ pointer, reducedMotion }: { pointer: RefObject<PointerState>; reducedMotion: boolean }) {
  useFrame(({ camera }, delta) => {
    const p = pointer.current
    const follow = p.active && !reducedMotion ? CAMERA_PARALLAX : 0
    const tx = CAMERA_POSITION[0] + p.x * follow
    const ty = CAMERA_POSITION[1] + p.y * follow
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tx, CAMERA_DAMPING, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, ty, CAMERA_DAMPING, delta)
    camera.lookAt(LOOK_AT)
  })
  return null
}

export default function MainScene() {
  const pointer = useMousePosition()
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    setReducedMotion(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  }, [])

  return (
    <div className="scene">
      <Canvas
        dpr={[1, 2]}
        flat // no tone mapping: keeps the cartoon colors exactly as written
        fallback={<p className="fallback">Your browser could not start WebGL, so the 3D pickle cannot be shown.</p>}
      >
        <PerspectiveCamera makeDefault fov={35} position={CAMERA_POSITION} />
        <CameraRig pointer={pointer} reducedMotion={reducedMotion} />

        {/* Cel lighting: one warm key light makes the hard shadow shape; a cool ambient sets the shadow color.
            No rim light: with toon shading it would brighten every surface and wash the shadows out. */}
        <ambientLight intensity={1.35} color="#cfe3f2" />
        <directionalLight position={[3.5, 4, 4]} intensity={2.1} color="#fff3dc" />

        {/* Try expression="curious" or "surprised" here to preview other poses. */}
        <PickleRick expression="idle" pointer={pointer} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  )
}
