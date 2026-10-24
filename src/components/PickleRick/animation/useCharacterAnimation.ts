// Runs the animation layers once per frame, in a fixed order, then moves the character's groups.
// It runs at priority -1, so it finishes before the face and mouth read the state in their own useFrame.
import { useMemo, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { PointerState } from '../../../hooks/useMousePosition'
import { playBoing, playChirp, playGrumble, playStartle } from '../../../audio/sfx'
import type { ExpressionName } from '../ExpressionController'
import { updateExpression } from '../ExpressionController'
import { BODY_BOTTOM_X } from '../bodyShape'
import { GROUND_Y } from '../limbs/limbConfig'
import { updateBlink } from './blinkLayer'
import { updateLimbs } from './limbLayer'
import type { CharacterState } from './characterState'
import { updateCursor } from './cursorLayer'
import { moveDrag, updateDrag } from './dragLayer'
import { updateEyeMicro } from './eyeMicroLayer'
import { updateIdle } from './idleLayer'
import { updateLook } from './lookLayer'
import { updateReactions } from './reactionLayer'
import { auraFlash, spawnRing, updateAura } from './auraLayer'
import { dragBoundX } from '../../../scene/viewport'

const CHARACTER_CENTER_Y = 0.2 // world point that stands for "where the character is" on screen
const HOP_HEIGHT = 0.5 // world units per unit of spring kick
const STRETCH = 0.35 // body stretch per unit of kick (negative kick squashes)
const LEAN_BACK = 0.5 // radians the body rocks back per unit of kick
const MICRO_WHILE_TRACKING = 0.55 // eye micro-movements shrink while the eyes follow the cursor
const MICRO_REDUCED_MOTION = 0.5

interface Targets {
  drag: RefObject<THREE.Group | null>
  root: RefObject<THREE.Group | null>
  torso: RefObject<THREE.Group | null>
  shadow: RefObject<THREE.Mesh | null>
}

interface Options {
  /** The base expression. Reactions can override it for a moment. */
  expression: ExpressionName
  pointer: RefObject<PointerState>
  reducedMotion: boolean
}

export function useCharacterAnimation(state: RefObject<CharacterState>, targets: Targets, options: Options) {
  const center = useMemo(() => new THREE.Vector3(), [])
  // Previous frame's fall speed + reaction, to spot landings and fresh reactions for sounds.
  // Plain numbers in a memo: no allocation in the loop, no React re-renders.
  const soundTrack = useMemo(() => ({ fallSpeed: 0, override: null as ExpressionName | null }), [])
  // Reused every frame to turn the pointer into a drag target: no allocation in the loop.
  const dragTools = useMemo(
    () => ({
      raycaster: new THREE.Raycaster(),
      ndc: new THREE.Vector2(),
      plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), // z=0 plane through home
      hit: new THREE.Vector3(),
    }),
    [],
  )

  useFrame(({ clock, camera, size }, delta) => {
    const s = state.current
    const pointer = options.pointer.current
    const t = clock.elapsedTime
    const dt = Math.min(delta, 0.1)
    const motion = options.reducedMotion ? 0 : 1

    center.set(0, CHARACTER_CENTER_Y, 0).project(camera)
    updateCursor(s.cursor, pointer, center.x, center.y, size.width / size.height, t, delta)

    // While held, the pointer target follows the hand on the z=0 plane.
    if (s.drag.dragging && pointer.active) {
      const { raycaster, ndc, plane, hit } = dragTools
      ndc.set(pointer.x, pointer.y)
      raycaster.setFromCamera(ndc, camera)
      if (raycaster.ray.intersectPlane(plane, hit) !== null) {
        // Shrink the drag range to the visible width, so the pickle can't be lost
        // off-screen on phones. Runs every frame, so rotating mid-drag re-clamps.
        const aspect = size.width / Math.max(size.height, 1)
        moveDrag(s.drag, hit.x, hit.y, dragBoundX(camera.position.z, aspect))
      }
    }

    // While held, don't let fast hand waves trigger startle/angry: hold excited instead.
    const savedSpeed = s.cursor.speed
    const savedArrived = s.cursor.arrived
    if (s.drag.dragging) {
      s.cursor.speed = 0
      s.cursor.arrived = false
    }
    updateReactions(s.reaction, s.cursor, t, dt) //                       layer 4: temporary reaction
    s.cursor.speed = savedSpeed
    s.cursor.arrived = savedArrived
    // Fresh reactions get a voice and a flare: rising edges only, so a held pose doesn't stutter.
    // Flashes and rings are motion, so they stay off under reduced motion (sound still plays).
    if (s.reaction.override !== soundTrack.override) {
      soundTrack.override = s.reaction.override
      if (s.reaction.override === 'surprised') {
        playStartle()
        if (motion > 0) {
          auraFlash(s.aura, 0.8)
          spawnRing(s.aura, s.drag.x)
        }
      } else if (s.reaction.override === 'angry') {
        playGrumble()
        if (motion > 0) auraFlash(s.aura, 0.5)
      } else if (s.reaction.override === 'excited') {
        playChirp()
        if (motion > 0) {
          auraFlash(s.aura, 0.35)
          spawnRing(s.aura, s.drag.x)
        }
      }
    }
    // Being carried reads as excitement: wide eyes, grin, arms up (from the pose table, no special-casing).
    const face = s.drag.dragging ? 'excited' : (s.reaction.override ?? options.expression)
    updateExpression(s.pose, face, dt) // layer 3: expression
    updateIdle(s.idle, t, dt, s.pose.energy, motion) //                   layer 1: base idle
    updateLook(s.look, pointer, s.cursor.proximity, dt, motion) //        layer 2: look direction
    // Landing: remember the fall speed before physics runs; a fast touchdown boings.
    soundTrack.fallSpeed = !s.drag.dragging && s.drag.y > 0.001 ? Math.max(0, -s.drag.vy) : 0
    updateDrag(s.drag, dt, motion) //                                     layer 5: drag physics
    if (!s.drag.dragging && s.drag.y === 0 && soundTrack.fallSpeed > 0.8) {
      playBoing(soundTrack.fallSpeed)
      if (motion > 0) {
        auraFlash(s.aura, Math.min(1, soundTrack.fallSpeed / 5))
        spawnRing(s.aura, s.drag.x)
      }
    }

    updateBlink(s.blink, t, s.reaction.blinkRequest, s.pose.blinkRate)
    const micro = (pointer.active ? MICRO_WHILE_TRACKING : 1) * (options.reducedMotion ? MICRO_REDUCED_MOTION : 1)
    updateEyeMicro(s.eyeMicro, t, dt, micro)
    updateLimbs(s.limbs, s.idle, s.pose, s.reaction.kick, dt, motion)
    // Layer 6: glow follows the displayed face, excitement, hops and flight. Kick and speed are
    // already motion-scaled (or zero) under reduced motion, so the glow simply goes calm.
    updateAura(
      s.aura, face, s.pose.energy, s.reaction.kick * motion,
      Math.hypot(s.drag.vx, s.drag.vy), s.drag.dragging, dt,
    )

    applyBodyTransform(s, t, motion, targets)
  }, -1)
}

/** Adds the layers together and writes the result to the character's groups. */
function applyBodyTransform(s: CharacterState, t: number, motion: number, { drag, root, torso, shadow }: Targets) {
  const kick = s.reaction.kick * motion
  const hop = Math.max(kick, 0) * HOP_HEIGHT
  const stretch = kick * STRETCH
  // Two unrelated fast sines make a shake rather than a vibration. Only the angry pose has tremble > 0.
  const tremble = s.pose.tremble * motion * (0.01 * Math.sin(t * 61) + 0.006 * Math.sin(t * 43 + 1))

  if (drag.current) {
    drag.current.position.set(s.drag.x, s.drag.y, 0)
    drag.current.rotation.z = s.drag.tilt
  }

  if (root.current) {
    root.current.position.y = s.idle.bob + hop
    root.current.rotation.set(
      s.idle.nod + s.look.pitch - kick * LEAN_BACK,
      s.idle.turn + s.look.yaw,
      s.idle.sway + s.look.roll + s.pose.headTilt + tremble,
    )
  }

  if (torso.current) {
    // Wider while shorter and the reverse, so the volume looks constant.
    // Drag squash (landing bounce / held stretch) multiplies with the hop stretch.
    const squash = s.drag.squash * motion
    const sy = (1 - s.idle.breath * 0.5) * (1 + stretch) * (1 + squash)
    const sxz = (1 + s.idle.breath) * (1 - stretch * 0.5) * (1 - squash * 0.5)
    torso.current.scale.set(sxz, sy, sxz)
    // Scaling happens around the middle; shift so the feet stay on the ground.
    torso.current.position.y = -GROUND_Y * (sy - 1)
  }

  if (shadow.current) {
    const lift = hop + Math.max(s.idle.bob, 0) + s.drag.y // higher = smaller shadow
    const k = Math.max(1 - lift * 0.35, 0.3) // why 0.35: drag lifts (~2 units) shrink more gently than hops did
    shadow.current.position.x = BODY_BOTTOM_X + s.drag.x // follow sideways throws
    shadow.current.scale.set(k, 0.8 * k, 1)
  }
}
