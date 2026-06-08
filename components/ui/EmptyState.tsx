interface EmptyStateProps {
  icon: string
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-[#1a1a1d] border-2 border-dashed border-slate-700 rounded-2xl flex items-center justify-center text-2xl mb-4">
        {icon}
      </div>
      <p className="text-white text-sm font-semibold mb-1">{title}</p>
      {description && (
        <p className="text-slate-500 text-sm max-w-xs mb-4">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="bg-indigo-600 hover:bg-indigo-500 text-[#050505] text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
