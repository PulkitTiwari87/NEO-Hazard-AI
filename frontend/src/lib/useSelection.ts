import { useSearchParams } from 'react-router-dom'
import { EXPERIMENTS, MODELS } from './research'
import { useExperiments } from './useApi'

/**
 * Experiment/model selection lives in the URL (?exp=&model=) so a view can be
 * linked and reloaded. Defaults to the first *executed* combination when the
 * API reports one, so the initial view is never an avoidable empty state.
 */
export function useSelection() {
  const [params, setParams] = useSearchParams()
  const experiments = useExperiments().data

  let defaultExp = 'leakage_aware'
  let defaultModel = 'random_forest'
  if (experiments?.status === 'ok') {
    outer: for (const e of EXPERIMENTS) {
      const models = experiments.experiments[e.key]?.models ?? {}
      for (const m of MODELS) {
        if (models[m]?.executed) {
          defaultExp = e.key
          defaultModel = m
          break outer
        }
      }
    }
    // Prefer the primary leakage-aware experiment when it has results.
    const primary = experiments.experiments.leakage_aware?.models ?? {}
    if (MODELS.some((m) => primary[m]?.executed)) {
      defaultExp = 'leakage_aware'
      defaultModel = primary.random_forest?.executed
        ? 'random_forest'
        : (MODELS.find((m) => primary[m]?.executed) ?? defaultModel)
    }
  }

  const experiment = params.get('exp') ?? defaultExp
  const model = params.get('model') ?? defaultModel

  function set(next: { exp?: string; model?: string }) {
    const p = new URLSearchParams(params)
    p.set('exp', next.exp ?? experiment)
    p.set('model', next.model ?? model)
    setParams(p, { replace: true })
  }

  return { experiment, model, setExperiment: (exp: string) => set({ exp }), setModel: (m: string) => set({ model: m }) }
}
