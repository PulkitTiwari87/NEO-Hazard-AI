import { EXPERIMENTS, MODELS, modelLabel } from '../lib/research'
import { useExperiments } from '../lib/useApi'

interface SegmentedProps {
  label: string
  options: { value: string; text: string; sub?: string; executed?: boolean }[]
  value: string
  onChange: (value: string) => void
}

function Segmented({ label, options, value, onChange }: SegmentedProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{label}</span>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs transition-colors ${
              active
                ? 'border-accent/60 bg-accent-soft text-ink'
                : 'border-line text-muted hover:border-line-strong hover:text-ink'
            }`}
          >
            {o.executed !== undefined && (
              <span
                aria-hidden="true"
                className={`text-[8px] leading-none ${o.executed ? 'text-ok' : 'text-faint'}`}
                title={o.executed ? 'Executed' : 'Not executed'}
              >
                {o.executed ? '●' : '○'}
              </span>
            )}
            <span className="font-medium">{o.text}</span>
            {o.sub && <span className="hidden font-mono text-[10px] text-faint sm:inline">{o.sub}</span>}
            {o.executed !== undefined && <span className="sr-only">{o.executed ? '(executed)' : '(not executed)'}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function ExperimentSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const list = useExperiments().data
  return (
    <Segmented
      label="Experiment"
      value={value}
      onChange={onChange}
      options={EXPERIMENTS.map((e) => ({
        value: e.key,
        text: e.letter,
        sub: e.title,
        executed:
          list?.status === 'ok' ? Object.values(list.experiments[e.key]?.models ?? {}).some((m) => m.executed) : undefined,
      }))}
    />
  )
}

export function ModelSelector({
  value,
  onChange,
  experiment,
}: {
  value: string
  onChange: (v: string) => void
  experiment: string
}) {
  const list = useExperiments().data
  return (
    <Segmented
      label="Model"
      value={value}
      onChange={onChange}
      options={MODELS.map((m) => ({
        value: m,
        text: modelLabel(m),
        executed: list?.status === 'ok' ? Boolean(list.experiments[experiment]?.models[m]?.executed) : undefined,
      }))}
    />
  )
}
