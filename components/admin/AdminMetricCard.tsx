interface AdminMetricCardProps {
  label: string
  value: string | number
  trend?: { value: string; up: boolean } | null
  subtext?: string
}

export default function AdminMetricCard({ label, value, trend, subtext }: AdminMetricCardProps) {
  return (
    <div
      style={{
        background: 'var(--admin-card-bg)',
        border: '1px solid var(--admin-border)',
        borderRadius: 8,
        padding: '20px 24px',
        boxShadow: 'var(--admin-shadow)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '.07em',
          textTransform: 'uppercase',
          color: 'var(--admin-muted)',
          fontFamily: 'var(--font-sans)',
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 500,
          fontFamily: 'var(--font-mono)',
          color: 'var(--admin-ink)',
          lineHeight: 1.2,
          marginBottom: trend || subtext ? 8 : 0,
        }}
      >
        {value}
      </div>
      {trend && (
        <div
          style={{
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: trend.up ? 'var(--admin-accent)' : 'var(--admin-red)',
          }}
        >
          {trend.up ? '+' : ''}{trend.value}
        </div>
      )}
      {subtext && !trend && (
        <div style={{ fontSize: 12, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)' }}>
          {subtext}
        </div>
      )}
    </div>
  )
}
