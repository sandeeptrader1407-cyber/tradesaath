import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react'

/* ─── Input ─── */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
  label?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, label, className = '', id, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label
            htmlFor={id}
            style={{
              display: 'block',
              fontFamily: 'var(--font-dm-sans, DM Sans, system-ui, sans-serif)',
              fontSize: 11,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-muted)',
              marginBottom: 6,
            }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`input${error ? ' input-error' : ''} ${className}`.trim()}
          {...props}
        />
        {error && <p className="input-error-msg">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

/* ─── Textarea ─── */
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, label, className = '', id, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label
            htmlFor={id}
            className="t-label"
            style={{ display: 'block', marginBottom: 6 }}
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={`input ctx-textarea${error ? ' input-error' : ''} ${className}`.trim()}
          {...props}
        />
        {error && <p className="input-error-msg">{error}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

/* ─── Select ─── */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string
  label?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, label, className = '', id, children, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label htmlFor={id} className="t-label" style={{ display: 'block', marginBottom: 6 }}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={`input ctx-select${error ? ' input-error' : ''} ${className}`.trim()}
          {...props}
        >
          {children}
        </select>
        {error && <p className="input-error-msg">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
