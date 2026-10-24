// Layer 3, expression: every expression is a table entry with the same fields, so the face
// components never need `if (expression === ...)`. To add one: add its name to ExpressionName,
// a pose to EXPRESSIONS and a speed to EXPRESSION_SPEED. TypeScript fails the build if any is missing.
import { MathUtils } from 'three'

export type ExpressionName = 'idle' | 'curious' | 'surprised' | 'angry' | 'smug' | 'excited'
export const EXPRESSION_NAMES: ExpressionName[] = ['idle', 'curious', 'surprised', 'angry', 'smug', 'excited']

export interface ExpressionPose {
  /** y: offset from rest height. rotZ: radians, positive = inner end of the brow goes up. */
  browLeft: { y: number; rotZ: number }
  browRight: { y: number; rotZ: number }
  /** 1 = normal, >1 = wide eyes. */
  eyeScale: number
  /** 1 = fully open, <1 = lids lowered (squint, half-lidded). Blinking multiplies with it. */
  eyeOpen: number
  /** <1 = tiny shocked pupils. */
  pupilScale: number
  /** 0 = nearly closed, 1 = fully open. */
  mouthOpen: number
  /** 1 = normal width. */
  mouthWidth: number
  /** -1 = frown, 0 = flat, 1 = grin. */
  mouthSmile: number
  /** >0 raises the right corner (smirk), <0 raises the left. */
  mouthSkew: number
  /** Whole-character lean in radians around Z. */
  headTilt: number
  /** Multiplies the speed and size of idle motion. 1 = normal, 2 = bouncy, 0.7 = calm. */
  energy: number
  /** 0..1 anger shake. */
  tremble: number
  /** 1 = normal blink frequency. */
  blinkRate: number
  /** Arms: 0 = hanging, 1 = thrown up in the air. */
  armLift: number
  /** Elbows: 0 = loose, 1 = bent hard (fists in, hands on hips). */
  armBend: number
}

export const EXPRESSIONS: Record<ExpressionName, ExpressionPose> = {
  idle: {
    // Even at rest: one brow a little higher and a lopsided grin, so the default look is sarcastic.
    browLeft: { y: 0.025, rotZ: 0.1 },
    browRight: { y: -0.01, rotZ: -0.06 },
    eyeScale: 1,
    eyeOpen: 1,
    pupilScale: 1,
    mouthOpen: 0.6,
    mouthWidth: 1,
    mouthSmile: 1,
    mouthSkew: 0.25,
    headTilt: 0,
    energy: 1,
    tremble: 0,
    blinkRate: 1,
    armLift: 0, armBend: 0,
  },
  curious: {
    browLeft: { y: 0.07, rotZ: 0.2 },
    browRight: { y: -0.02, rotZ: -0.3 },
    eyeScale: 1.05,
    eyeOpen: 1,
    pupilScale: 1.1,
    mouthOpen: 0.3,
    mouthWidth: 0.92,
    mouthSmile: 0.35,
    mouthSkew: 0.5,
    headTilt: 0.08,
    energy: 1.1,
    tremble: 0,
    blinkRate: 0.7,
    armLift: 0.1, armBend: 0.5,
  },
  surprised: {
    browLeft: { y: 0.1, rotZ: 0.4 },
    browRight: { y: 0.1, rotZ: 0.4 },
    eyeScale: 1.18,
    eyeOpen: 1,
    pupilScale: 0.65,
    mouthOpen: 1,
    mouthWidth: 0.85,
    mouthSmile: 0,
    mouthSkew: 0,
    headTilt: 0,
    energy: 1.3,
    tremble: 0,
    blinkRate: 0.3,
    armLift: 0.7, armBend: 0.2,
  },
  angry: {
    browLeft: { y: -0.05, rotZ: -0.3 },
    browRight: { y: -0.05, rotZ: -0.3 },
    eyeScale: 0.98,
    eyeOpen: 0.72,
    pupilScale: 0.8,
    mouthOpen: 0.55,
    mouthWidth: 1.12,
    mouthSmile: -0.9,
    mouthSkew: 0,
    headTilt: -0.04,
    energy: 1.3,
    tremble: 1,
    blinkRate: 0.4,
    armLift: 0.25, armBend: 1,
  },
  smug: {
    browLeft: { y: 0.06, rotZ: 0.15 },
    browRight: { y: -0.03, rotZ: -0.15 },
    eyeScale: 1,
    eyeOpen: 0.6,
    pupilScale: 1,
    mouthOpen: 0.3,
    mouthWidth: 1.05,
    mouthSmile: 1,
    mouthSkew: 0.8,
    headTilt: -0.07,
    energy: 0.7,
    tremble: 0,
    blinkRate: 0.6,
    armLift: 0.05, armBend: 0.8,
  },
  excited: {
    browLeft: { y: 0.11, rotZ: 0.15 },
    browRight: { y: 0.11, rotZ: 0.15 },
    eyeScale: 1.22,
    eyeOpen: 1,
    pupilScale: 1.2,
    mouthOpen: 1,
    mouthWidth: 1.15,
    mouthSmile: 1.5,
    mouthSkew: 0,
    headTilt: 0.05,
    energy: 2,
    tremble: 0,
    blinkRate: 1.6,
    armLift: 1, armBend: 0.3,
  },
}

/** How fast the face moves INTO each expression (higher = snappier). A startle is quick, a smirk creeps in. */
export const EXPRESSION_SPEED: Record<ExpressionName, number> = {
  idle: 5,
  curious: 6,
  surprised: 16,
  angry: 9,
  smug: 4,
  excited: 10,
}

/** A fresh, independent copy of a pose (so easing it never edits the table). */
export const clonePose = (pose: ExpressionPose): ExpressionPose => structuredClone(pose)

type Tree = { [key: string]: number | Tree }

// Walks every number in the pose, so a field added to ExpressionPose is eased automatically.
function dampTree(current: Tree, target: Tree, lambda: number, delta: number): void {
  for (const key in current) {
    const c = current[key]
    const t = target[key]
    if (typeof c === 'number' && typeof t === 'number') current[key] = MathUtils.damp(c, t, lambda, delta)
    else if (typeof c === 'object' && typeof t === 'object') dampTree(c, t, lambda, delta)
  }
}

/**
 * Eases `current` toward `target` in place. Called every frame.
 * MathUtils.damp is frame-rate independent: it feels the same at 60 Hz and 144 Hz.
 */
export function dampPose(current: ExpressionPose, target: ExpressionPose, lambda: number, delta: number): void {
  dampTree(current as unknown as Tree, target as unknown as Tree, lambda, delta)
}

/** Eases the live pose toward the named expression, at that expression's own speed. */
export function updateExpression(pose: ExpressionPose, name: ExpressionName, delta: number): void {
  dampPose(pose, EXPRESSIONS[name], EXPRESSION_SPEED[name], delta)
}
