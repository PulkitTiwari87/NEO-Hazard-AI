import { EXPERIMENT_IDS, EXPERIMENT_LABEL, type ExperimentId } from '../../api/client'

interface ExperimentSelectorProps {
  value: ExperimentId
  onChange: (value: ExperimentId) => void
}

export function ExperimentSelector({ value, onChange }: ExperimentSelectorProps) {
  return (
    <div className="flex gap-1 rounded-md border border-white/10 bg-black/20 p-1 text-xs">
      {EXPERIMENT_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded px-3 py-1.5 transition-colors ${
            value === id ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          {EXPERIMENT_LABEL[id]}
        </button>
      ))}
    </div>
  )
}
