import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VisaFit — H-1B Job Analyzer',
  description:
    'Check H-1B sponsorship history, ghost job signals, and resume fit before you apply. Stop wasting applications on dead-end roles.',
  openGraph: {
    title: 'VisaFit — Should you burn a credit on this job?',
    description: 'Real DOL LCA data + AI analysis for visa holders job searching in the US.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {children}
      </body>
    </html>
  )
}
