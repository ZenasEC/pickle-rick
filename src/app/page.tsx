// The only page. Server component: static text for screen readers + the client-side 3D scene.
import MainScene from '../scene/MainScene'

export default function Home() {
  return (
    <main>
      <h1 className="sr-only">Pickle Prototype 0.1</h1>
      <p className="sr-only">
        A 3D cartoon pickle character with big eyes, a heavy brow and a toothy grin, standing
        in a cartoon laboratory with a workbench, shelves and crates. It breathes,
        blinks, and its eyes follow your mouse pointer. You can also drag it around and drop it;
        it bounces and wobbles back to place. A jagged golden flame aura with crackling
        lightning around it brightens with its mood, with an Aura on/off button below the scene.
        It also makes small synthesized sounds when grabbed,
        thrown, landing and reacting, with a Sound on/off button below the scene.
        The animation is decorative.
      </p>
      <MainScene />
    </main>
  )
}
