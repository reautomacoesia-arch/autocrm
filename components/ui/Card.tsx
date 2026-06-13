import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  children?: React.ReactNode
}

export default function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div className={`bg-[#1a1a1d] border border-slate-700 rounded-xl ${className}`} {...props}>
      {children}
    </div>
  )
}
