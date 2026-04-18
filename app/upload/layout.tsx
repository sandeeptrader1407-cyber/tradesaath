import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Upload — TradeSaath',
}

export default function UploadLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
