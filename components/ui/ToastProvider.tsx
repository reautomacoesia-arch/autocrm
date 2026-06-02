'use client'
import { createContext, useCallback, useContext, useState } from 'react'
import { X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}

const ICONS: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
}

const COLORS: Record<ToastType, { bg: string; border: string; text: string; close: string }> = {
  success: { bg: 'bg-green-950', border: 'border-green-700', text: 'text-green-100', close: 'text-green-400' },
  error:   { bg: 'bg-red-950',   border: 'border-red-700',   text: 'text-red-100',   close: 'text-red-400' },
  info:    { bg: 'bg-slate-800', border: 'border-slate-600', text: 'text-slate-100', close: 'text-slate-400' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const c = COLORS[t.type]
          return (
            <div
              key={t.id}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border shadow-lg pointer-events-auto min-w-[260px] max-w-[360px] ${c.bg} ${c.border}`}
            >
              <span className="text-sm flex-shrink-0">{ICONS[t.type]}</span>
              <span className={`text-sm font-medium flex-1 ${c.text}`}>{t.message}</span>
              <button onClick={() => dismiss(t.id)} className={`flex-shrink-0 ${c.close} hover:opacity-70`}>
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
