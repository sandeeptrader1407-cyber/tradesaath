import { HTMLAttributes } from 'react'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number
  height?: string | number
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

const roundedMap = {
  sm:   '4px',
  md:   '6px',
  lg:   '10px',
  full: '9999px',
}

export function Skeleton({
  width,
  height,
  rounded = 'md',
  className = '',
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`.trim()}
      style={{
        width,
        height,
        borderRadius: roundedMap[rounded],
        ...style,
      }}
      {...props}
    />
  )
}

/* ─── Pre-composed skeletons ─── */

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          width={i === lines - 1 ? '65%' : '100%'}
          rounded="sm"
        />
      ))}
    </div>
  )
}

export function SkeletonKPI() {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <Skeleton height={10} width={60} rounded="sm" style={{ marginBottom: 8 }} />
      <Skeleton height={22} width={80} rounded="sm" />
    </div>
  )
}
