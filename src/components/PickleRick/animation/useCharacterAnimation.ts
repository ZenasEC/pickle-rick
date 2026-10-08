// Runs the animation layers once per frame, in a fixed order, then moves the character's groups.
// It runs at priority -1, so it finishes before the face and mouth read the state in their own useFrame.
import { useMemo, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { PointerState } from '../../../hooks/useMousePosition'
import type { ExpressionName } from '../ExpressionController'
import { updateExpression } from '../ExpressionController'
import { BODY_BOTTOM_Y } from '../PickleBody'
import { updateBlink } from './blinkLayer'
import type { CharacterState } from './characterState'
import { updateCursor } from './cursorLayer'
import { updateEyeMicro } from './eyeMicroLayer'
import { updateIdle } from './idleLayer'
import { updateLook } from './lookLayer'
import { updateReactions } from './reactionLayer'

const CHARACTER_CENTER_Y = 0.2 // world point that stands for "where the character is" on screen
const HOP_HEIGHT = 0.5 // world units per unit of spring kick
const STRETCH = 0.35 // body stretch per unit of kick (negative kick squashes)
const LEAN_BACK = 0.5 // radians the body rocks back per unit of kick
const MICRO_WHILE_TRACKING = 0.55 // eye micro-movements shrink while the eyes follow the cursor
const MICRO_REDUCED_MOTION = 0.5

interface Targets {
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

  useFrame(({ clock, camera, size }, delta) => {
    const s = state.current
    const pointer = options.pointer.current
    const t = clock.elapsedTime
    const dt = Math.min(delta, 0.1)
    const motion = options.reducedMotion ? 0 : 1

    center.set(0, CHARACTER_CENTER_Y, 0).project(camera)
    updateCursor(s.cursor, pointer, center.x, center.y, size.width / size.height, t, delta)

    updateReactions(s.reaction, s.cursor, t, dt) //                       layer 4: temporary reaction
    updateExpression(s.pose, s.reaction.override ?? options.expression, dt) // layer 3: expression
    updateIdle(s.idle, t, dt, s.pose.energy, motion) //                   layer 1: base idle
    updateLook(s.look, pointer, s.cursor.proximity, dt, motion) //        layer 2: look direction

    updateBlink(s.blink, t, s.reaction.blinkRequest, s.pose.blinkRate)
    const micro = (pointer.active ? MICRO_WHILE_TRACKING : 1) * (options.reducedMotion ? MICRO_REDUCED_MOTION : 1)
    updateEyeMicro(s.eyeMicro, t, dt, micro)

    applyBodyTransform(s, t, motion, targets)
  }, -1)
}

/** Adds the layers together and writes the result to the character's groups. */
function applyBodyTransform(s: CharacterState, t: number, motion: number, { root, torso, shadow }: Targets) {
  const kick = s.reaction.kick * motion
  const hop = Math.max(kick, 0) * HOP_HEIGHT
  const stretch = kick * STRETCH
  // Two unrelated fast sines make a shake rather than a vibration. Only the angry pose has tremble > 0.
  const tremble = s.pose.tremble * motion * (0.01 * Math.sin(t * 61) + 0.006 * Math.sin(t * 43 + 1))

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
    const sy = (1 - s.idle.breath * 0.5) * (1 + stretch)
    const sxz = (1 + s.idle.breath) * (1 - stretch * 0.5)
    torso.current.scale.set(sxz, sy, sxz)
    // Scaling happens around the middle; shift so the feet stay on the ground.
    torso.current.position.y = -BODY_BOTTOM_Y * (sy - 1)
  }

  if (shadow.current) {
    const k = 1 - (hop + Math.max(s.idle.bob, 0)) * 1.2 // smaller when the pickle is higher
    shadow.current.scale.set(k, 0.8 * k, 1)
  }
}
