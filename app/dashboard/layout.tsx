import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard — TradeSaath',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
