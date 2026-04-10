'use client'

interface ChatFABProps {
  onClick: () => void
  visible: boolean
}

export function ChatFAB({ onClick, visible }: ChatFABProps) {
  if (!visible) return null

  return (
    <button
      onClick={onClick}
      className="fixed z-[150] flex items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-110 active:scale-95"
      style={{
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        background: 'linear-gradient(135deg, var(--accent), #3b82f6)',
        boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
      }}
      aria-label="Open AI Chat"
    >
      <span className="text-2xl" role="img" aria-label="chat">
        {'\u{1F4AC}'}
      </span>
    </button>
  )
}
