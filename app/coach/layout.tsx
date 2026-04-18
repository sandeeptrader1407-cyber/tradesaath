import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Saathi — TradeSaath',
}

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
