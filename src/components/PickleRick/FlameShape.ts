// Pure 2D shape math and procedural generators for the Super Saiyan aura:
// - flameFlicker: multi-frequency harmonic flame flicker
// - buildAuraSpires: exact Dragon Ball Z anime flame spires (outer jagged envelope, mid blaze, inner core, front tongues)
// - writeSpireVertices: dynamic per-frame vertex writer with smooth vertical gradients
// - boltPoints & writeBolt: sharp lightning paths with cyan glow and white core
// - createGroundGlowCanvas: procedural radial golden glow pool for the floor
// All pure math and buffer operations: zero asset files, 100% testable without WebGL.

export function flameFlicker(t: number, phase: number): number {
  return (
    Math.sin(t * 13 + phase) * 0.5 +
    Math.sin(t * 29 + phase * 1.7) * 0.3 +
    Math.sin(t * 7 + phase * 0.6) * 0.2
  )
}

/**
 * Jagged anime flame outline (x, y pairs): zigzag spikes climbing both edges to a tall tip,
 * narrow at the top like a roaring blaze. Base sits on y=0, x stays inside ±halfW.
 */
export function flameSilhouettePoints(halfW: number, h: number, spikes: number): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i <= spikes; i++) {
    const f = i / spikes
    pts.push([-halfW * (1 - 0.5 * f) * (i % 2 === 0 ? 1 : 0.52), f * h])
  }
  pts.push([0.06 * halfW, h * 1.02]) // the tallest tip, flicked slightly aside
  for (let i = spikes; i >= 0; i--) {
    const f = i / spikes
    pts.push([halfW * (1 - 0.5 * f) * (i % 2 === 0 ? 0.52 : 1), f * h])
  }
  return pts
}

/** Tiny seeded PRNG: same seed always draws the same bolt. */
export function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let z = Math.imul(s ^ (s >>> 15), 1 | s)
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296
  }
}

export interface BoltEnds {
  from: [number, number]
  to: [number, number]
}

/** Crooked lightning path: exact endpoints, jittered midpoints. Returns segs+1 points. */
export function boltPoints(seed: number, ends: BoltEnds, segs: number, jitter: number): [number, number][] {
  const rnd = mulberry32(seed)
  const pts: [number, number][] = [[ends.from[0], ends.from[1]]]
  for (let i = 1; i < segs; i++) {
    const f = i / segs
    pts.push([
      ends.from[0] + (ends.to[0] - ends.from[0]) * f + (rnd() * 2 - 1) * jitter,
      ends.from[1] + (ends.to[1] - ends.from[1]) * f + (rnd() * 2 - 1) * jitter * 0.6,
    ])
  }
  pts.push([ends.to[0], ends.to[1]])
  return pts
}

/**
 * Writes a flat ribbon strip for a bolt path into a preallocated (segs+1)*2*3 buffer:
 * two verts per point, offset along the path's 2D normal. No allocation, safe per regen.
 */
export function writeBolt(positions: Float32Array, points: [number, number][], width: number): void {
  const hw = width / 2
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(i - 1, 0)]
    const next = points[Math.min(i + 1, points.length - 1)]
    const dx = next[0] - prev[0]
    const dy = next[1] - prev[1]
    const len = Math.hypot(dx, dy) || 1
    const nx = (-dy / len) * hw
    const ny = (dx / len) * hw
    const o = i * 6
    positions[o] = points[i][0] + nx
    positions[o + 1] = points[i][1] + ny
    positions[o + 2] = 0
    positions[o + 3] = points[i][0] - nx
    positions[o + 4] = points[i][1] - ny
    positions[o + 5] = 0
  }
}

// --- Super Saiyan Anime Spire System ---

export interface SpireDef {
  bx: number
  by: number
  tx: number
  ty: number
  w: number
  phase: number
  // RGB 0..1 colors at base, mid, and tip
  baseCol: [number, number, number]
  midCol: [number, number, number]
  tipCol: [number, number, number]
}

/**
 * Builds the dense anime spire definitions for the Super Saiyan aura:
 * - Back aura: jagged outer perimeter spikes fanning outward, tall crown spears, dense mid fill, white-hot core
 * - Front aura: flame spires licking upward in front of legs and belly
 */
export function buildSuperSaiyanSpires(): { back: SpireDef[]; front: SpireDef[] } {
  const back: SpireDef[] = []
  const front: SpireDef[] = []

  // Color palettes:
  const goldTip: [number, number, number] = [1.0, 0.78, 0.05]
  const brightMid: [number, number, number] = [1.0, 0.95, 0.28]
  const whiteHot: [number, number, number] = [1.0, 1.0, 0.9]

  // 1. Back Outer Spikes (Left flank: sweeping up-left)
  const leftOuter: [number, number, number, number, number][] = [
    [-0.45, -1.5, -0.95, -1.05, 0.38],
    [-0.55, -1.35, -1.25, -0.75, 0.42],
    [-0.65, -1.15, -1.5, -0.35, 0.46],
    [-0.72, -0.9, -1.72, 0.1, 0.48],
    [-0.78, -0.6, -1.88, 0.6, 0.52],
    [-0.8, -0.3, -1.95, 1.05, 0.54],
    [-0.75, 0.05, -1.9, 1.5, 0.52],
    [-0.7, 0.4, -1.75, 1.95, 0.48],
    [-0.6, 0.75, -1.55, 2.35, 0.46],
    [-0.48, 1.05, -1.25, 2.7, 0.44],
    [-0.35, 1.25, -0.95, 2.95, 0.4],
  ]

  // Add intermediate left spikes for dense, jagged anime silhouette
  leftOuter.forEach(([bx, by, tx, ty, w], i) => {
    back.push({
      bx, by, tx, ty, w, phase: i * 0.73,
      baseCol: whiteHot, midCol: brightMid, tipCol: goldTip,
    })
    // In-between jagged tooth
    if (i < leftOuter.length - 1) {
      const next = leftOuter[i + 1]
      back.push({
        bx: (bx + next[0]) * 0.5,
        by: (by + next[1]) * 0.5,
        tx: (tx + next[2]) * 0.45,
        ty: (ty + next[3]) * 0.5,
        w: w * 0.75,
        phase: i * 0.73 + 2.1,
        baseCol: whiteHot, midCol: brightMid, tipCol: goldTip,
      })
    }
  })

  // 2. Back Outer Spikes (Right flank: mirrored sweeping up-right)
  leftOuter.forEach(([bx, by, tx, ty, w], i) => {
    back.push({
      bx: -bx, by, tx: -tx, ty, w, phase: (i + 12) * 0.73,
      baseCol: whiteHot, midCol: brightMid, tipCol: goldTip,
    })
    if (i < leftOuter.length - 1) {
      const next = leftOuter[i + 1]
      back.push({
        bx: -(bx + next[0]) * 0.5,
        by: (by + next[1]) * 0.5,
        tx: -(tx + next[2]) * 0.45,
        ty: (ty + next[3]) * 0.5,
        w: w * 0.75,
        phase: (i + 12) * 0.73 + 2.1,
        baseCol: whiteHot, midCol: brightMid, tipCol: goldTip,
      })
    }
  })

  // 3. Towering Crown Spears (Shooting straight up into the sky over the head)
  const crown: [number, number, number, number, number][] = [
    [-0.25, 1.2, -0.45, 3.15, 0.4],
    [-0.12, 1.25, -0.2, 3.4, 0.38],
    [0.0, 1.3, 0.0, 3.55, 0.42], // Summit spear
    [0.12, 1.25, 0.2, 3.4, 0.38],
    [0.25, 1.2, 0.45, 3.15, 0.4],
  ]
  crown.forEach(([bx, by, tx, ty, w], i) => {
    back.push({
      bx, by, tx, ty, w, phase: 25 + i * 0.88,
      baseCol: whiteHot, midCol: brightMid, tipCol: goldTip,
    })
  })

  // 4. Dense Mid Blaze (Fills the volume directly behind the character)
  for (let step = -4; step <= 4; step++) {
    const x = step * 0.16
    back.push({
      bx: x * 0.8, by: -1.3,
      tx: x * 1.5, ty: 1.8 + (1 - Math.abs(step) * 0.15) * 1.0,
      w: 0.55, phase: 40 + step * 1.3,
      baseCol: whiteHot, midCol: brightMid, tipCol: goldTip,
    })
  }

  // 5. White-Hot Energy Core (Hug directly behind Pickle Rick)
  for (let c = -3; c <= 3; c++) {
    const cx = c * 0.14
    back.push({
      bx: cx, by: -1.1,
      tx: cx * 1.2, ty: 1.4 + (1 - Math.abs(c) * 0.2) * 0.8,
      w: 0.45, phase: 60 + c * 1.7,
      baseCol: [1.0, 1.0, 1.0], midCol: [1.0, 1.0, 0.85], tipCol: [1.0, 0.95, 0.4],
    })
  }

  // 6. Front Flank Flames (Rising in FRONT of Pickle Rick's legs and lower belly)
  for (let f = -5; f <= 5; f++) {
    const fx = f * 0.14
    const h = 0.85 + (1 - Math.abs(f) * 0.15) * 0.75
    front.push({
      bx: fx * 0.9, by: -1.5,
      tx: fx * 1.2 + (f < 0 ? -0.1 : 0.1), ty: -1.5 + h,
      w: 0.32, phase: 80 + f * 1.4,
      baseCol: whiteHot, midCol: brightMid, tipCol: goldTip,
    })
  }

  return { back, front }
}

/**
 * Writes dynamic vertices (pos 3 floats, col 3 floats per vert) for a list of spires:
 * 5 vertices per spire: BaseL, BaseR, MidL, MidR, Tip
 * (3 triangles = 9 indices per spire)
 */
export function writeSpireGeometry(
  posArray: Float32Array,
  colArray: Float32Array,
  spires: SpireDef[],
  t: number,
  roar: number,
  tint: { r: number; g: number; b: number },
): void {
  for (let i = 0; i < spires.length; i++) {
    const s = spires[i]
    const f1 = flameFlicker(t * 1.8, s.phase)
    const f2 = Math.sin(t * 26.0 + s.phase * 2.1)
    const f3 = Math.cos(t * 16.0 + s.phase * 1.3)

    // Dynamic height and lateral wave
    const hMul = roar * (1.0 + 0.16 * f1 + 0.08 * f2)
    const wMul = 1.0 + 0.07 * f1
    const sway = 0.06 * f3

    const bx = s.bx
    const by = s.by
    const tx = s.bx + (s.tx - s.bx) * (1.0 + 0.05 * f2) + sway
    const ty = s.by + (s.ty - s.by) * hMul

    const mx = (bx + tx) * 0.5 + sway * 0.5
    const my = (by + ty) * 0.5

    const hw = (s.w * wMul) * 0.5
    const hmw = hw * 0.65

    const vBase = i * 5
    const pBase = vBase * 3

    // Vertex 0: Base Left
    posArray[pBase + 0] = bx - hw
    posArray[pBase + 1] = by
    posArray[pBase + 2] = 0

    // Vertex 1: Base Right
    posArray[pBase + 3] = bx + hw
    posArray[pBase + 4] = by
    posArray[pBase + 5] = 0

    // Vertex 2: Mid Left
    posArray[pBase + 6] = mx - hmw
    posArray[pBase + 7] = my
    posArray[pBase + 8] = 0

    // Vertex 3: Mid Right
    posArray[pBase + 9] = mx + hmw
    posArray[pBase + 10] = my
    posArray[pBase + 11] = 0

    // Vertex 4: Tip
    posArray[pBase + 12] = tx
    posArray[pBase + 13] = ty
    posArray[pBase + 14] = 0

    // Colors with mood tint
    const tr = tint.r
    const tg = tint.g
    const tb = tint.b

    // Verts 0 & 1: Base color
    colArray[pBase + 0] = s.baseCol[0] * tr
    colArray[pBase + 1] = s.baseCol[1] * tg
    colArray[pBase + 2] = s.baseCol[2] * tb
    colArray[pBase + 3] = s.baseCol[0] * tr
    colArray[pBase + 4] = s.baseCol[1] * tg
    colArray[pBase + 5] = s.baseCol[2] * tb

    // Verts 2 & 3: Mid color
    colArray[pBase + 6] = s.midCol[0] * tr
    colArray[pBase + 7] = s.midCol[1] * tg
    colArray[pBase + 8] = s.midCol[2] * tb
    colArray[pBase + 9] = s.midCol[0] * tr
    colArray[pBase + 10] = s.midCol[1] * tg
    colArray[pBase + 11] = s.midCol[2] * tb

    // Vert 4: Tip color
    colArray[pBase + 12] = s.tipCol[0] * tr
    colArray[pBase + 13] = s.tipCol[1] * tg
    colArray[pBase + 14] = s.tipCol[2] * tb
  }
}

/** Prepares a BufferGeometry with indices for N spires */
export function createSpireIndex(count: number): number[] {
  const indices: number[] = []
  for (let i = 0; i < count; i++) {
    const o = i * 5
    // Tri 1: 0, 1, 2
    indices.push(o + 0, o + 1, o + 2)
    // Tri 2: 1, 3, 2
    indices.push(o + 1, o + 3, o + 2)
    // Tri 3: 2, 3, 4
    indices.push(o + 2, o + 3, o + 4)
  }
  return indices
}

/** Creates a procedural radial golden glow canvas texture for the floor puddle */
export function createGroundGlowCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 256)
  grad.addColorStop(0.0, 'rgba(255, 255, 240, 1.0)') // pure luminous white-gold
  grad.addColorStop(0.18, 'rgba(255, 248, 120, 0.95)')
  grad.addColorStop(0.38, 'rgba(255, 222, 35, 0.85)') // vibrant Super Saiyan gold
  grad.addColorStop(0.62, 'rgba(255, 185, 10, 0.50)') // amber gold ring
  grad.addColorStop(0.85, 'rgba(255, 150, 0, 0.18)')
  grad.addColorStop(1.0, 'rgba(255, 120, 0, 0.0)') // smooth transparent fade

  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 512, 512)

  // Inner bright glow accent
  const inner = ctx.createRadialGradient(256, 256, 0, 256, 256, 120)
  inner.addColorStop(0.0, 'rgba(255, 255, 255, 0.8)')
  inner.addColorStop(0.5, 'rgba(255, 250, 160, 0.4)')
  inner.addColorStop(1.0, 'rgba(255, 240, 100, 0.0)')
  ctx.fillStyle = inner
  ctx.fillRect(0, 0, 512, 512)

  return canvas
}
