'use client'

import { useState, useMemo } from 'react'
import type { ReactNode } from 'react'

export interface AdminColumn {
  key: string
  label: string
  sortable?: boolean
  width?: string
  mono?: boolean
  render?: (value: unknown, row: Record<string, unknown>) => ReactNode
}

interface AdminTableProps {
  columns: AdminColumn[]
  rows: Record<string, unknown>[]
  keyField: string
  pageSize?: number
  expandedId?: string | null
  onExpand?: (id: string | null) => void
  renderExpanded?: (row: Record<string, unknown>) => ReactNode
  emptyText?: string
  loading?: boolean
}

export default function AdminTable({
  columns,
  rows,
  keyField,
  pageSize = 20,
  expandedId,
  onExpand,
  renderExpanded,
  emptyText = 'No records.',
  loading = false,
}: AdminTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize)

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  const thStyle: React.CSSProperties = {
    padding: '0 14px',
    height: 36,
    textAlign: 'left',
    fontSize: 10,
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    letterSpacing: '.07em',
    textTransform: 'uppercase',
    color: 'var(--admin-muted)',
    borderBottom: '1px solid var(--admin-border)',
    background: 'var(--admin-card-bg)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  }

  const tdStyle: React.CSSProperties = {
    padding: '0 14px',
    height: 40,
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    color: 'var(--admin-ink)',
    borderBottom: '1px solid var(--admin-border)',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  }

  if (loading) {
    return (
      <div
        style={{
          background: 'var(--admin-card-bg)',
          border: '1px solid var(--admin-border)',
          borderRadius: 8,
          padding: '40px 0',
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--admin-muted)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Loading...
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--admin-card-bg)',
        border: '1px solid var(--admin-border)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: 'var(--admin-shadow)',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{
                    ...thStyle,
                    width: col.width,
                    cursor: col.sortable ? 'pointer' : 'default',
                  }}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ ...tdStyle, textAlign: 'center', color: 'var(--admin-muted)', height: 60 }}
                >
                  {emptyText}
                </td>
              </tr>
            )}
            {paginated.map(row => {
              const id = String(row[keyField] ?? '')
              const isExpanded = expandedId === id
              return (
                <>
                  <tr
                    key={id}
                    onClick={onExpand ? () => onExpand(isExpanded ? null : id) : undefined}
                    style={{
                      cursor: onExpand ? 'pointer' : 'default',
                      background: isExpanded ? 'var(--admin-accent-dim)' : undefined,
                    }}
                    onMouseEnter={e => {
                      if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--admin-row-hover)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLTableRowElement).style.background = isExpanded ? 'var(--admin-accent-dim)' : ''
                    }}
                  >
                    {columns.map(col => (
                      <td
                        key={col.key}
                        style={{
                          ...tdStyle,
                          fontFamily: col.mono ? 'var(--font-mono)' : 'var(--font-sans)',
                        }}
                      >
                        {col.render
                          ? col.render(row[col.key], row)
                          : String(row[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && renderExpanded && (
                    <tr key={`${id}-expanded`}>
                      <td
                        colSpan={columns.length}
                        style={{
                          padding: '16px 14px',
                          background: 'var(--admin-accent-dim)',
                          borderBottom: '1px solid var(--admin-border)',
                        }}
                      >
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderTop: '1px solid var(--admin-border)',
            background: 'var(--admin-card-bg)',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--admin-muted)', fontFamily: 'var(--font-mono)' }}>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              style={pagerBtnStyle(page <= 1)}
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              style={pagerBtnStyle(page >= totalPages)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function pagerBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    border: '1px solid var(--admin-border)',
    borderRadius: 4,
    background: disabled ? 'transparent' : 'var(--admin-card-bg)',
    color: disabled ? 'var(--admin-muted)' : 'var(--admin-ink)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}
