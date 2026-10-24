// Pointer handlers that make the whole character grabbable. Press down on any body part
// to pick it up, move to carry it, release anywhere to throw it. Motion values stay in the
// shared CharacterState ref, so grabbing never causes a React re-render.
// The per-frame drag target comes from the existing pointer NDC (see useCharacterAnimation),
// so this hook only toggles the grab itself.
import { useEffect, type RefObject } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import type { CharacterState } from '../components/PickleRick/animation/characterState'
import { endDrag, startDrag } from '../components/PickleRick/animation/dragLayer'
import { playPop, playWhoosh } from '../audio/sfx'

const WHOOSH_MIN_SPEED = 2 // slower drops just land; only real throws whistle

/** Whoosh scaled by release speed, silent for gentle put-downs. */
function releaseSound(s: CharacterState): void {
  const speed = Math.hypot(s.drag.vx, s.drag.vy)
  if (speed > WHOOSH_MIN_SPEED) playWhoosh(speed / 8)
}

export function useDragInteraction(stateRef: RefObject<CharacterState>) {
  // Belt and braces: if the pointer is released off the mesh (fast fling without
  // pointer capture), the mesh may never see pointer-up. The window always does.
  useEffect(() => {
    const onUp = () => {
      const s = stateRef.current
      if (s?.drag.dragging) {
        endDrag(s.drag)
        releaseSound(s)
        document.body.style.cursor = ''
      }
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [stateRef])

  return {
    /** Grab: e.point is the world hit on the body, so the pickle doesn't jump to the cursor. */
    onPointerDown(e: ThreeEvent<PointerEvent>) {
      e.stopPropagation()
      const s = stateRef.current
      if (!s || s.drag.dragging) return
      startDrag(s.drag, e.point.x, e.point.y)
      playPop()
      // Keep receiving move/up events even if the pointer leaves the mesh mid-drag.
      try {
        (e.target as Element).setPointerCapture(e.pointerId)
      } catch {
        // Very old browsers: the window pointerup listener above still ends the drag.
      }
      document.body.style.cursor = 'grabbing'
    },
    onPointerUp(e: ThreeEvent<PointerEvent>) {
      e.stopPropagation()
      const s = stateRef.current
      if (s?.drag.dragging) {
        endDrag(s.drag)
        releaseSound(s)
        document.body.style.cursor = ''
      }
    },
    onPointerOver(e: ThreeEvent<PointerEvent>) {
      e.stopPropagation()
      const s = stateRef.current
      if (s && !s.drag.dragging) document.body.style.cursor = 'grab'
    },
    onPointerOut() {
      const s = stateRef.current
      if (s && !s.drag.dragging) document.body.style.cursor = ''
    },
  }
}
