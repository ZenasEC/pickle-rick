// The only page. Server component: static text for screen readers + the client-side 3D scene.
import MainScene from '../scene/MainScene'

export default function Home() {
  return (
    <main>
      <h1 className="sr-only">Pickle Prototype 0.1</h1>
      <p className="sr-only">
        A 3D cartoon pickle character with big eyes, a heavy brow and a toothy grin. It breathes,
        blinks, and its eyes follow your mouse pointer. The animation is decorative.
      </p>
      <MainScene />
    </main>
  )
}
