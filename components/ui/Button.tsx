import { ButtonHTMLAttributes, AnchorHTMLAttributes, forwardRef } from 'react'
import Link from 'next/link'

type Variant = 'primary' | 'accent' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  accent:  'btn-accent',
  ghost:   'btn-ghost',
  danger:  'btn-danger',
}

const sizeClass: Record<Size, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) => {
    const cls = ['btn', variantClass[variant], sizeClass[size], className]
      .filter(Boolean)
      .join(' ')
    return (
      <button ref={ref} className={cls} {...props}>
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

/* ─── Link variant ─── */
interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  variant?: Variant
  size?: Size
}

export function ButtonLink({ href, variant = 'primary', size = 'md', className = '', children, ...props }: ButtonLinkProps) {
  const cls = ['btn', variantClass[variant], sizeClass[size], className]
    .filter(Boolean)
    .join(' ')
  return (
    <Link href={href} className={cls} {...props}>
      {children}
    </Link>
  )
}
