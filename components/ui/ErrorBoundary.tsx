'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
  name?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ''}]`, error.message, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          className="rounded-xl border p-8 text-center"
          style={{
            background: 'var(--s1)',
            borderColor: 'var(--border)',
            margin: '16px 0',
          }}
        >
          <p style={{
            fontFamily: 'var(--font-dm-serif, DM Serif Display, serif)',
            fontSize: 20, fontWeight: 400, color: 'var(--color-ink)',
            marginBottom: 8,
          }}>
            Something went wrong.
          </p>
          <p style={{
            fontFamily: 'var(--font-dm-sans, DM Sans, system-ui, sans-serif)',
            fontSize: 14, color: 'var(--color-muted)', marginBottom: 20, lineHeight: 1.7,
          }}>
            This section encountered an error. Your data has not been affected.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn btn-ghost btn-sm"
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
