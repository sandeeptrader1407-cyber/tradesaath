import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Journey — TradeSaath',
}

export default function JourneyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
