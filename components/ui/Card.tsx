import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean
}

export function Card({ padding = false, className = '', children, ...props }: CardProps) {
  return (
    <div className={`card${padding ? ' card-body' : ''} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card-head ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}

export function CardBody({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card-body ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
