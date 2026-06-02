'use client'
import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be inside ConfirmProvider')
  return ctx.confirm
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  function handleConfirm() {
    resolveRef.current?.(true)
    setOptions(null)
  }

  function handleCancel() {
    resolveRef.current?.(false)
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={handleCancel} />
          <div className="relative bg-[#1e293b] border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl mx-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-xl ${options.destructive ? 'bg-red-950' : 'bg-amber-950'}`}>
              {options.destructive ? '🗑️' : '⚠️'}
            </div>
            <h2 className="text-white text-base font-semibold mb-2">{options.title}</h2>
            {options.description && (
              <p className="text-slate-400 text-sm mb-5">{options.description}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2.5 text-sm hover:border-slate-500 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className={`flex-1 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                  options.destructive
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {options.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
