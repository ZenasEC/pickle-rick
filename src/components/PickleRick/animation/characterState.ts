// All the live animation values of one character, in one mutable object that lives in a ref.
// Each layer owns one field and only writes to it; the components only read.
import { EXPRESSIONS, clonePose, type ExpressionPose } from '../ExpressionController'
import { createBlink, type BlinkState } from './blinkLayer'
import { createCursor, type CursorState } from './cursorLayer'
import { createDrag, type DragState } from './dragLayer'
import { createAura, type AuraState } from './auraLayer'
import { createEyeMicro, type EyeMicroState } from './eyeMicroLayer'
import { createIdle, type IdleState } from './idleLayer'
import { createLook, type LookState } from './lookLayer'
import { createReactions, type ReactionState } from './reactionLayer'
import { createLimbs, type LimbLayerState } from './limbLayer'

export interface CharacterState {
  /** Layer 1, base idle. */
  idle: IdleState
  /** Layer 2, look direction. */
  look: LookState
  /** Layer 3, expression: the eased face pose. */
  pose: ExpressionPose
  /** Layer 4, temporary reactions. */
  reaction: ReactionState
  /** Cursor analysis feeding the layers above. */
  cursor: CursorState
  blink: BlinkState
  eyeMicro: EyeMicroState
  /** Joint angles of the four limbs, combined from the layers above. */
  limbs: LimbLayerState
  /** Drag and drop physics offset (position, velocity, squash, lean). */
  drag: DragState
  /** Cartoon glow: shell brightness, mood color, ground bursts. */
  aura: AuraState
}

export function createCharacterState(): CharacterState {
  return {
    idle: createIdle(),
    look: createLook(),
    pose: clonePose(EXPRESSIONS.idle),
    reaction: createReactions(),
    cursor: createCursor(),
    blink: createBlink(),
    eyeMicro: createEyeMicro(),
    limbs: createLimbs(),
    drag: createDrag(),
    aura: createAura(),
  }
}
