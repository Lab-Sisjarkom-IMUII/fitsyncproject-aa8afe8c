import './globals.css'
import { Inter } from 'next/font/google'
import AuthProvider from './AuthProvider'
import { XpProvider } from '@/context/XpContext'
import { ToastProvider } from '@/components/ui/Toast'
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'FitSync Web',
  description: 'Your Wellness, Synced.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0D1117" />
        <link rel="apple-touch-icon" href="/icons/icon-192.jpg" />
      </head>
      <body className={`${inter.className} bg-[#0E0E12] text-white`}>
        <AuthProvider>
          <XpProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </XpProvider>
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}