import { useEffect, useState } from 'react'
import { Newspaper } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import type { MarketNewsItem } from '../types'

export function LiveNewsFeedPanel() {
  const [news, setNews] = useState<MarketNewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch('/api/market-news?limit=25')
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setNews(d.news ?? [])
        })
        .catch(() => {
          if (!cancelled) setNews([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }
    load()
    const timer = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return (
    <GlassPanel title="Live Market News" className="h-full" action={<Newspaper size={14} className="text-desk-info" />}>
      <div className="h-full overflow-y-auto p-2 text-xs">
        {loading && <p className="text-desk-muted">Loading headlines…</p>}
        {!loading && news.length === 0 && (
          <p className="text-desk-muted">No news available.</p>
        )}
        <div className="space-y-2">
          {news.map((item) => (
            <article
              key={item.id}
              className="rounded border border-desk-border/50 bg-desk-bg/40 p-2 hover:border-desk-info/30"
            >
              <p className="text-[11px] font-medium leading-snug text-desk-text">{item.headline}</p>
              <p className="mt-1 text-[9px] text-desk-muted">
                {item.source}
                {item.created_at && ` · ${formatTime(item.created_at)}`}
              </p>
              {item.symbols.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.symbols.map((s) => (
                    <span key={s} className="rounded bg-desk-info/10 px-1 py-px text-[8px] text-desk-info">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {item.summary && (
                <p className="mt-1 text-[10px] leading-relaxed text-desk-muted">{item.summary}</p>
              )}
            </article>
          ))}
        </div>
      </div>
    </GlassPanel>
  )
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}