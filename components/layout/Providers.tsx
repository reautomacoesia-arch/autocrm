'use client'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { ConfirmProvider } from '@/components/ui/ConfirmModal'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        {children}
      </ConfirmProvider>
    </ToastProvider>
  )
}
