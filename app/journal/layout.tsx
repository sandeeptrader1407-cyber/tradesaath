import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Journal — TradeSaath',
}

export default function JournalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
