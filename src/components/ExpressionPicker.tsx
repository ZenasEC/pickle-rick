// Cartoon button bar for switching the character's base expression.
// Real <button>s, so keyboard, focus and screen readers work for free. Temporary cursor
// reactions (startle, curiosity, ...) still override for a moment; this sets the base mood
// the character returns to. Purely presentational: state lives in MainScene.
import { EXPRESSION_NAMES, type ExpressionName } from './PickleRick/ExpressionController'

// One label + shortcut key per expression. Keys 1-6 select in table order.
const LABELS: Record<ExpressionName, string> = {
  idle: 'Idle',
  curious: 'Curious',
  surprised: 'Surprised',
  angry: 'Angry',
  smug: 'Smug',
  excited: 'Excited',
}

interface ExpressionPickerProps {
  value: ExpressionName
  onChange: (name: ExpressionName) => void
  muted: boolean
  onToggleMute: () => void
  auraOn: boolean
  onToggleAura: () => void
}

export default function ExpressionPicker({ value, onChange, muted, onToggleMute, auraOn, onToggleAura }: ExpressionPickerProps) {
  return (
    <div className="expression-picker" role="group" aria-label="Character expression">
      {EXPRESSION_NAMES.map((name, i) => (
        <button
          key={name}
          type="button"
          className={name === value ? 'expression-button active' : 'expression-button'}
          aria-pressed={name === value}
          title={`${LABELS[name]} (press ${i + 1})`}
          onClick={() => onChange(name)}
        >
          {LABELS[name]}
        </button>
      ))}
      <button
        type="button"
        className="expression-button mute"
        aria-pressed={muted}
        title="Toggle sound"
        onClick={onToggleMute}
      >
        {muted ? 'Sound off' : 'Sound on'}
      </button>
      <button
        type="button"
        className={auraOn ? 'expression-button mute active' : 'expression-button mute'}
        aria-pressed={auraOn}
        title="Toggle aura"
        onClick={onToggleAura}
      >
        {auraOn ? 'Aura on' : 'Aura off'}
      </button>
    </div>
  )
}
