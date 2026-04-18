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
          <div style={{ fontSize: 40, marginBottom: 12 }}>{String.fromCodePoint(0x1F6E0)}</div>
          <h3
            className="text-lg font-semibold mb-2"
            style={{ color: 'var(--text)', fontFamily: "'Fraunces', serif" }}
          >
            Something went wrong
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text2)' }}>
            This section encountered an error. Your data is safe.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-5 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: 'var(--accent)',
              color: '#0a0e17',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
