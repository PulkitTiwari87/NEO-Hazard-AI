interface ResearchNotesProps {
  notes: string[]
  title?: string
}

// Standing caveats/interpretation notes attached to a results screen — never
// scientific conclusions without evidence, always the caveat next to the number.
export function ResearchNotes({ notes, title = 'Research notes' }: ResearchNotesProps) {
  if (notes.length === 0) return null
  return (
    <div className="rounded-lg border border-amber-700/30 bg-amber-950/20 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/80">{title}</p>
      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-amber-200/90">
        {notes.map((note, i) => (
          <li key={i}>• {note}</li>
        ))}
      </ul>
    </div>
  )
}
