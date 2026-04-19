import type { Metadata } from 'next'
import '../index.css'

export const metadata: Metadata = {
  title: 'Sauron – Fleet Digital Twin',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
