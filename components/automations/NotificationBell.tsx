'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import type { Notification } from '@/lib/types'
import Link from 'next/link'

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'agora'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `há ${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days}d`
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifications.filter((n) => !n.read).length

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadNotifications() {
    const res = await fetch('/api/notifications')
    if (res.ok) {
      const data = await res.json()
      setNotifications(data)
    }
  }

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'DELETE' })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function markOneRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen((p) => !p)}
        className="relative flex items-center justify-center w-8 h-8 text-slate-400 hover:text-slate-200 transition-colors rounded-md hover:bg-slate-700/50"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-full ml-2 top-0 w-80 bg-[#1a1a1d] border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <p className="text-white text-sm font-semibold">Notificações</p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                Nenhuma notificação
              </div>
            ) : (
              notifications.map((n) => {
                const inner = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-700/30 cursor-pointer ${n.read ? 'opacity-60' : ''}`}
                    onClick={() => markOneRead(n.id)}
                  >
                    {!n.read && (
                      <span className="flex-shrink-0 mt-1.5 w-2 h-2 bg-indigo-500 rounded-full" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium leading-tight">{n.title}</p>
                      {n.body && <p className="text-slate-400 text-xs mt-0.5 truncate">{n.body}</p>}
                      <p className="text-slate-600 text-xs mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                )

                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setIsOpen(false)}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
