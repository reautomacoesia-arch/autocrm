interface SparklineProps {
  data: number[]
  color?: string
  className?: string
}

export default function Sparkline({ data, color = '#d4af37', className = '' }: SparklineProps) {
  const width = 100
  const height = 24

  let points: string

  if (data.length < 2) {
    points = `0,${height / 2} ${width},${height / 2}`
  } else {
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min

    points = data
      .map((value, index) => {
        const x = (index / (data.length - 1)) * width
        const y =
          range === 0
            ? height / 2
            : height - ((value - min) / range) * height
        return `${x},${y}`
      })
      .join(' ')
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}
