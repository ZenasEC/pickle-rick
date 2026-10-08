// Tracks the pointer anywhere in the browser window (not just over the canvas) as
// normalized device coordinates: x and y go from -1 to +1, with +y up.
// Values live in a ref, so moving the mouse never causes a React re-render.
import { useEffect, useRef } from 'react'

export interface PointerState {
  x: number
  y: number
  /** false before the first move and after the pointer leaves the window. */
  active: boolean
}

export function useMousePosition() {
  const pointer = useRef<PointerState>({ x: 0, y: 0, active: false })

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = -(e.clientY / window.innerHeight) * 2 + 1
      pointer.current.active = true
    }
    const onLeave = () => {
      pointer.current.active = false
    }
    const root = document.documentElement
    window.addEventListener('pointermove', onMove)
    root.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return pointer
}
