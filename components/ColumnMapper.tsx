'use client'

import { useState } from 'react'
import type { ColumnMapping, ColumnRole } from '@/lib/parsers/types'

const ROLE_OPTIONS: { value: ColumnRole; label: string }[] = [
  { value: 'ignore', label: '— skip —' },
  { value: 'date', label: 'Date / Time' },
  { value: 'symbol', label: 'Symbol / Instrument' },
  { value: 'side', label: 'Buy / Sell' },
  { value: 'qty', label: 'Quantity' },
  { value: 'price', label: 'Price' },
  { value: 'pnl', label: 'P&L (optional)' },
]

const REQUIRED: ColumnRole[] = ['date', 'symbol', 'side', 'qty', 'price']

interface Props {
  headers: string[]
  sampleRow: Record<string, string>
  initialMapping: ColumnMapping
  onConfirm: (mapping: ColumnMapping) => void
  onCancel: () => void
}

export default function ColumnMapper({ headers, sampleRow, initialMapping, onConfirm, onCancel }: Props) {
  const [mapping, setMapping] = useState<ColumnMapping>({ ...initialMapping })

  function setRole(header: string, role: ColumnRole) {
    setMapping((prev) => {
      const next = { ...prev }
      // If another header already has this non-ignore role, unassign it
      if (role !== 'ignore') {
        for (const [h, r] of Object.entries(next)) {
          if (h !== header && r === role) {
            next[h] = 'ignore'
          }
        }
      }
      next[header] = role
      return next
    })
  }

  const assignedRoles = new Set<string>(Object.values(mapping).filter((r) => r !== 'ignore'))
  const missingRequired = REQUIRED.filter((r) => !assignedRoles.has(r))
  const canConfirm = missingRequired.length === 0

  return (
    <div className="mapper-wrap">
      <div className="mapper-header">
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Map Your Columns</div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>
            Tell us which column is which. Required: date, symbol, buy/sell, quantity, price.
          </div>
        </div>
      </div>

      <div className="mapper-grid">
        {headers.map((h) => (
          <div key={h} className="mapper-row">
            <div className="mapper-col-name">
              <div className="mapper-col-header">{h}</div>
              <div className="mapper-col-sample">{sampleRow[h] || '—'}</div>
            </div>
            <select
              className="ctx-select mapper-select"
              value={mapping[h] || 'ignore'}
              onChange={(e) => setRole(h, e.target.value as ColumnRole)}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {missingRequired.length > 0 && (
        <div className="mapper-missing">
          Missing: {missingRequired.map((r) => {
            const label = ROLE_OPTIONS.find((o) => o.value === r)?.label || r
            return label
          }).join(', ')}
        </div>
      )}

      <div className="mapper-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          className="btn btn-accent"
          disabled={!canConfirm}
          onClick={() => onConfirm(mapping)}
        >
          Confirm Mapping
        </button>
      </div>
    </div>
  )
}
