import Image from 'next/image'

interface ProfileAvatarProps {
  name: string
  color: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE: Record<string, { container: string; text: string; px: number }> = {
  sm: { container: 'w-6 h-6',  text: 'text-[10px]', px: 24  },
  md: { container: 'w-8 h-8',  text: 'text-xs',     px: 32  },
  lg: { container: 'w-10 h-10', text: 'text-sm',    px: 40  },
  xl: { container: 'w-20 h-20', text: 'text-2xl',   px: 80  },
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
}

export default function ProfileAvatar({
  name,
  color,
  avatarUrl,
  size = 'md',
  className = '',
}: ProfileAvatarProps) {
  const { container, text, px } = SIZE[size]

  if (avatarUrl) {
    return (
      <div className={`${container} rounded-full overflow-hidden flex-shrink-0 ${className}`} title={name}>
        <Image
          src={avatarUrl}
          alt={name}
          width={px}
          height={px}
          className="w-full h-full object-cover"
          unoptimized
        />
      </div>
    )
  }

  return (
    <div
      className={`${container} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 ${text} ${className}`}
      style={{ backgroundColor: color }}
      title={name}
    >
      {getInitials(name)}
    </div>
  )
}
