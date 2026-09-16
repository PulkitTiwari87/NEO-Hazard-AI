import { useEffect, useState } from 'react'
import { api, type LimitationsResponse } from '../api/client'

const POINTS = [
  {
    title: 'Not an impact predictor',
    body: "No model here estimates impact probability. NASA/JPL's \"potentially hazardous\" label is a geometric screening criterion (MOID and absolute magnitude thresholds), not an impact forecast.",
  },
  {
    title: 'Not a planetary-defense decision system',
    body: 'Nothing in this project should inform any real decision about tracking, deflection, or civil response to a NEO.',
  },
  {
    title: 'Not a replacement for NASA/JPL/CNEOS',
    body: "This project consumes NASA's public output; it does not audit, second-guess, or substitute for their orbit determination or hazard screening.",
  },
  {
    title: 'Anomaly scores are not hazard scores',
    body: 'The Isolation Forest anomaly score measures statistical unusualness in engineered feature space — it can flag a data-quality artifact just as easily as a genuinely unusual orbit.',
  },
  {
    title: 'SHAP explains the model, not physics',
    body: "SHAP values describe how a feature moved this trained model's output for this row. They are not a causal explanation of orbital dynamics.",
  },
]

export function Limitations() {
  const [scope, setScope] = useState<LimitationsResponse | null>(null)

  useEffect(() => {
    api.limitations().then(setScope).catch(() => null)
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Limitations</h2>

      {scope && (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
          {scope.summary}
        </p>
      )}

      <div className="space-y-3">
        {POINTS.map((point) => (
          <div key={point.title} className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
            <p className="text-sm font-medium text-slate-100">{point.title}</p>
            <p className="mt-1 text-sm text-slate-400">{point.body}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Full statement: <code>docs/LIMITATIONS.md</code>
      </p>
    </div>
  )
}
