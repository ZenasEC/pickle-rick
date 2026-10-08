// Root HTML shell shared by every page.
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pickle Prototype 0.1',
  description: 'An experimental interactive 3D cartoon pickle.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
