interface UnavailableNoticeProps {
  detail?: string
}

// Rendered whenever the backend reports status "unavailable" — i.e. real
// data or a real trained model does not exist yet. Never replaced with a
// placeholder number; this is the honest state.
export function UnavailableNotice({ detail }: UnavailableNoticeProps) {
  return (
    <div className="rounded-lg border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
      <p className="font-medium">Data unavailable</p>
      <p className="mt-1 text-amber-200/80">
        {detail ?? 'This has not been generated yet. Run the corresponding pipeline stage — see docs/REPRODUCIBILITY.md.'}
      </p>
    </div>
  )
}
