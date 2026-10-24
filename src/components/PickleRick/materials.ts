// Shared cartoon materials. Created once when the module loads and reused by every mesh,
// so React re-renders never rebuild them and the GPU switches state less often.
import * as THREE from 'three'

/** A toon gradient: each value is one brightness band. NearestFilter keeps the band edges hard, like a cartoon. */
function gradient(steps: number[]) {
  const texture = new THREE.DataTexture(new Uint8Array(steps), steps.length, 1, THREE.RedFormat)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.needsUpdate = true
  return texture
}

// Cel shading: a hard shadow band where the surface turns away from the key light, a small
// half-tone band, then full light. Surfaces facing away get only the ambient light.
const cel = gradient([0, 175, 255])
// Eye whites and teeth: a much fainter shadow, so they read as flat painted shapes, not grey balls.
const soft = gradient([200, 255])

const toon = (color: THREE.ColorRepresentation, gradientMap = cel) => new THREE.MeshToonMaterial({ color, gradientMap })

// Olive pickle greens (yellower and duller than lime, so it reads as a pickle, not a toy).
export const PICKLE_GREEN_DARK = new THREE.Color('#355f1c')
export const PICKLE_GREEN_LIGHT = new THREE.Color('#9ec34a')
export const OUTLINE_COLOR = '#0b1406'

export const materials = {
  // Body color comes from per-vertex colors (greens mixed), so the base color is white.
  body: new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap: cel }),
  bump: toon('#2f5419'),
  nose: toon('#7fae3e'),
  eyeWhite: toon('#fbf8ea', soft),
  pupil: new THREE.MeshBasicMaterial({ color: '#0a0a0a' }),
  brow: toon('#bde9ec'),
  // Double-sided: the mouth is rebuilt every frame, so don't depend on triangle winding.
  mouth: new THREE.MeshBasicMaterial({ color: '#2a070d', side: THREE.DoubleSide }),
  // Arms and legs: a flat, darker green than the body so they read as separate parts.
  limb: toon('#5a8a2a'),
  teeth: toon('#f4efd2', soft),
  tongue: toon('#e2566f', soft),
  shadow: new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25, depthWrite: false }),
}

// Laboratory palette. Same cartoon rules as the character: flat toon bands, no textures.
// Basic (unlit) materials are for things that glow: flask liquid, bubbles, the lamp bulb.
export const labMaterials = {
  floor: toon('#3a5f55'),
  mat: toon('#2c4a43'),
  wall: toon('#7fb3a0'),
  baseboard: toon('#22332e'),
  wood: toon('#8a5a33'),
  woodDark: toon('#6e4525'),
  metal: toon('#9aa7ad'),
  glass: new THREE.MeshToonMaterial({ color: '#cfe8e4', gradientMap: cel, transparent: true, opacity: 0.35 }),
  liquid: new THREE.MeshBasicMaterial({ color: '#8fe04e' }),
  bubble: new THREE.MeshBasicMaterial({ color: '#d6ff9e' }),
  bulb: new THREE.MeshBasicMaterial({ color: '#ffe9b0' }),
  shade: toon('#2e6b4f'),
  paper: toon('#e8e0c8', soft),
  frame: toon('#4a3220'),
  bottleAmber: toon('#c77b2e'),
  bottleBlue: toon('#4e8fd0'),
  bottleRed: toon('#c74e4e'),
  crate: toon('#a5763f'),
}
