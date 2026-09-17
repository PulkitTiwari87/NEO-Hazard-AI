import { MODEL_COLOR, MODEL_LABEL, MODEL_NAMES, type ModelName } from '../../api/client'

interface ModelSelectorProps {
  value: ModelName
  onChange: (value: ModelName) => void
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  return (
    <div className="flex gap-1 rounded-md border border-white/10 bg-black/20 p-1 text-xs">
      {MODEL_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name)}
          className="rounded px-3 py-1.5 transition-colors"
          style={
            value === name
              ? { backgroundColor: `color-mix(in oklab, ${MODEL_COLOR[name]} 22%, transparent)`, color: MODEL_COLOR[name] }
              : undefined
          }
        >
          <span className={value === name ? '' : 'text-slate-400 hover:text-slate-100'}>{MODEL_LABEL[name]}</span>
        </button>
      ))}
    </div>
  )
}
