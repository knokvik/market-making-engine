import clsx from 'clsx'

interface MetricCardProps {
  label: string
  value: string | number
  tone?: 'profit' | 'loss' | 'info' | 'warn' | 'neutral'
  sub?: string
}

export function MetricCard({ label, value, tone = 'neutral', sub }: MetricCardProps) {
  const toneClass = {
    profit: 'neon-profit',
    loss: 'neon-loss',
    info: 'neon-info',
    warn: 'neon-warn',
    neutral: 'text-white',
  }[tone]

  return (
    <div className="rounded-lg border border-desk-border/50 bg-black/20 px-2.5 py-2">
      <div className="metric-label">{label}</div>
      <div className={clsx('metric-value mt-0.5', toneClass)}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-desk-muted">{sub}</div>}
    </div>
  )
}