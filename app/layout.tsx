import type { Metadata } from 'next'
import { Inter, Montserrat, Roboto_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['500', '700', '800', '900'],
  variable: '--font-montserrat',
})
const robotoMono = Roboto_Mono({ subsets: ['latin'], variable: '--font-roboto-mono' })

export const metadata: Metadata = {
  title: 'KORVUS CRM',
  description: 'Inteligência que adapta. Automação que escala.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body
        className={`${inter.variable} ${montserrat.variable} ${robotoMono.variable} ${inter.className} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
