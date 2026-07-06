import clsx from 'clsx'

interface MetricCardProps {
  label: string
  value: string | number
  tone?: 'profit' | 'loss' | 'info' | 'warn' | 'neutral'
  sub?: string
}

export function MetricCard({ label, value, tone = 'neutral', sub }: MetricCardProps) {
  const toneClass = {
    profit: 'text-desk-profit',
    loss: 'text-desk-loss',
    info: 'text-desk-info',
    warn: 'text-desk-warn',
    neutral: 'text-desk-text',
  }[tone]

  return (
    <div className="rounded border border-desk-border bg-desk-bg px-2 py-1.5">
      <div className="metric-label">{label}</div>
      <div className={clsx('metric-value mt-0.5', toneClass)}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-desk-muted">{sub}</div>}
    </div>
  )
}