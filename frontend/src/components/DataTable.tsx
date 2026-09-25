import { Fragment, useMemo, useState, type ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number | null
  align?: 'left' | 'right'
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  caption: string
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  /** When provided, each row gets an expand toggle that reveals this content. */
  renderExpanded?: (row: T) => ReactNode
  empty?: ReactNode
  /** Paginate after sorting, so sort order applies to every row, not just one page. */
  pageSize?: number
  onPageSizeChange?: (size: number) => void
}

function compare(a: string | number | null, b: string | number | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1 // nulls always last
  if (b === null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  initialSort,
  renderExpanded,
  empty,
  pageSize,
  onPageSizeChange,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort ?? null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const column = columns.find((c) => c.key === sort.key)
    if (!column?.sortValue) return rows
    const get = column.sortValue
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((x, y) => {
      const ax = get(x)
      const ay = get(y)
      // Keep nulls last regardless of direction.
      if (ax === null || ay === null) return compare(ax, ay)
      return factor * compare(ax, ay)
    })
  }, [rows, columns, sort])

  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1
  const current = Math.min(page, pages - 1)
  const visible = pageSize ? sorted.slice(current * pageSize, (current + 1) * pageSize) : sorted

  function toggleSort(key: string) {
    setPage(0)
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  function toggleRow(id: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (rows.length === 0 && empty) return <>{empty}</>

  const span = columns.length + (renderExpanded ? 1 : 0)

  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-surface">
      <table className="w-full min-w-[36rem] border-collapse text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-raised">
          <tr>
            {renderExpanded && (
              <th scope="col" className="w-8 px-2 py-2">
                <span className="sr-only">Expand</span>
              </th>
            )}
            {columns.map((c) => {
              const active = sort?.key === c.key
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={`px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted ${c.align === 'right' ? 'text-right' : ''}`}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 uppercase tracking-[0.1em] hover:text-ink"
                    >
                      {c.header}
                      <span aria-hidden="true" className={active ? 'text-accent' : 'text-faint'}>
                        {active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const id = rowKey(row)
            const expanded = open.has(id)
            return (
              <Fragment key={id}>
                <tr className="border-t border-line transition-colors hover:bg-white/[0.025]">
                  {renderExpanded && (
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => toggleRow(id)}
                        aria-expanded={expanded}
                        aria-controls={`row-${id}`}
                        aria-label={`${expanded ? 'Collapse' : 'Expand'} row ${id}`}
                        className="flex h-6 w-6 items-center justify-center rounded-sm text-muted hover:bg-white/5 hover:text-ink"
                      >
                        <span aria-hidden="true" className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>
                          ▸
                        </span>
                      </button>
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-3 py-1.5 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c.className ?? ''}`}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
                {renderExpanded && expanded && (
                  <tr id={`row-${id}`} className="border-t border-line bg-raised/60">
                    <td colSpan={span} className="px-4 py-4">
                      {renderExpanded(row)}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      {pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2 font-mono text-[11px] text-muted">
          <span aria-live="polite">
            {fmtRange(current, pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-2">
            {onPageSizeChange && (
              <label className="flex items-center gap-1.5">
                Rows
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPage(0)
                    onPageSizeChange(Number(e.target.value))
                  }}
                  className="rounded-sm border border-line bg-surface px-1.5 py-0.5 text-ink"
                >
                  {[25, 50, 100].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              className="rounded-sm border border-line px-2 py-0.5 enabled:hover:text-ink disabled:opacity-40"
            >
              Prev
            </button>
            <span>
              {current + 1} / {pages}
            </span>
            <button
              type="button"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
              className="rounded-sm border border-line px-2 py-0.5 enabled:hover:text-ink disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function fmtRange(page: number, size: number, total: number): string {
  if (total === 0) return '0'
  return `${page * size + 1}–${Math.min(total, (page + 1) * size)}`
}
