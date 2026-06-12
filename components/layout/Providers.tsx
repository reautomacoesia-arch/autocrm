'use client'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { ConfirmProvider } from '@/components/ui/ConfirmModal'
import CommandPalette from '@/components/search/CommandPalette'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        {children}
        <CommandPalette />
      </ConfirmProvider>
    </ToastProvider>
  )
}
