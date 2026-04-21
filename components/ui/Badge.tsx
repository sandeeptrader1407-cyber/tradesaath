import { HTMLAttributes } from 'react'

type BadgeVariant = 'analysed' | 'pending' | 'failed' | 'pro' | 'free'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClass: Record<BadgeVariant, string> = {
  analysed: 'badge-analysed',
  pending:  'badge-pending',
  failed:   'badge-failed',
  pro:      'badge-pro',
  free:     'plan-badge-free',
}

export function Badge({ variant = 'pending', className = '', children, ...props }: BadgeProps) {
  return (
    <span className={`badge ${variantClass[variant]} ${className}`.trim()} {...props}>
      {children}
    </span>
  )
}
