'use client'

import type { ColumnMapping, ColumnRole } from '@/lib/parsers/types'

const ROLE_LABELS: Record<ColumnRole, string> = {
  date: 'Date/Time',
  symbol: 'Symbol',
  side: 'Buy/Sell',
  qty: 'Quantity',
  price: 'Price',
  pnl: 'P&L',
  ignore: '',
}

const ROLE_COLORS: Record<ColumnRole, string> = {
  date: 'var(--blue)',
  symbol: 'var(--accent)',
  side: 'var(--purple)',
  qty: 'var(--orange)',
  price: 'var(--green)',
  pnl: 'var(--gold)',
  ignore: 'transparent',
}

interface Props {
  headers: string[]
  rows: Record<string, string>[]
  mapping: ColumnMapping
}

export default function PreviewTable({ headers, rows, mapping }: Props) {
  const displayRows = rows.slice(0, 8)

  return (
    <div className="preview-wrap">
      <div className="preview-header">
        <span style={{ fontSize: 13, fontWeight: 600 }}>Data Preview</span>
        <span style={{ fontSize: 12, color: 'var(--muted2)' }}>
          {rows.length} row{rows.length !== 1 ? 's' : ''} detected
        </span>
      </div>
      <div className="preview-scroll">
        <table className="preview-table">
          <thead>
            <tr>
              {headers.map((h) => {
                const role = mapping[h] || 'ignore'
                const isMapped = role !== 'ignore'
                return (
                  <th
                    key={h}
                    className={isMapped ? 'preview-th-mapped' : 'preview-th-unmapped'}
                    style={isMapped ? { borderBottomColor: ROLE_COLORS[role] } : undefined}
                  >
                    <div className="preview-th-name">{h}</div>
                    {isMapped && (
                      <div className="preview-th-role" style={{ color: ROLE_COLORS[role] }}>
                        {ROLE_LABELS[role]}
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i}>
                {headers.map((h) => {
                  const role = mapping[h] || 'ignore'
                  return (
                    <td
                      key={h}
                      className={role !== 'ignore' ? 'preview-td-mapped' : 'preview-td-unmapped'}
                    >
                      {row[h] || ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 8 && (
        <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '6px 0' }}>
          + {rows.length - 8} more rows
        </div>
      )}
    </div>
  )
}
