// Pagination client réutilisable (hook + composant). Thémable, compacte.
import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Découpe un tableau en pages. Réinitialise à la page 1 si la liste rétrécit.
export function usePagination(items, perPage = 12) {
  const [page, setPage] = React.useState(1)
  const list = items ?? []
  const total = list.length
  const pages = Math.max(1, Math.ceil(total / perPage))
  React.useEffect(() => { if (page > pages) setPage(1) }, [pages]) // eslint-disable-line
  const slice = list.slice((page - 1) * perPage, page * perPage)
  return { page, setPage, pages, total, slice, perPage }
}

export default function Pagination({ page, pages, total, perPage, onPage }) {
  if (pages <= 1) return null
  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)
  const btn = (disabled) => ({
    background: 'var(--input-bg)', border: '1px solid var(--border)',
    color: disabled ? 'var(--text-dim)' : 'var(--text)', opacity: disabled ? 0.5 : 1,
  })
  return (
    <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
      <span className="text-sm" style={{ color: 'var(--text-dim)' }}>{from}–{to} sur {total}</span>
      <div className="flex items-center gap-1.5">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center" style={btn(page <= 1)}>
          <ChevronLeft size={15} />
        </button>
        <span className="text-sm font-medium px-2" style={{ color: 'var(--text-muted)' }}>{page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center" style={btn(page >= pages)}>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}
