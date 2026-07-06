import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { GlassPanel } from '../components/ui/GlassPanel'
import { MetricCard } from '../components/ui/MetricCard'
import type { TradeBookData } from '../types'

interface TradeBookPageProps {
  frameIndex?: number
  symbol?: string
  algoActive?: boolean
  embedded?: boolean
}

const POLL_MS = 2500

export function TradeBookPage({ frameIndex, symbol, algoActive, embedded }: TradeBookPageProps) {
  const [data, setData] = useState<TradeBookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [syncError, setSyncError] = useState(false)
  const [search, setSearch] = useState('')
  const [sideFilter, setSideFilter] = useState<'all' | 'BID' | 'ASK'>('all')
  const [strategyFilter, setStrategyFilter] = useState('all')

  const fetchBook = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    fetch('/api/trade-book')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setData(d)
        setSyncError(false)
        setLastSync(new Date())
      })
      .catch(() => {
        setData(null)
        setSyncError(true)
      })
      .finally(() => {
        if (!silent) setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchBook()
    const timer = setInterval(() => fetchBook(true), POLL_MS)
    return () => clearInterval(timer)
  }, [fetchBook, frameIndex])

  const strategies = useMemo(() => {
    const set = new Set(data?.completed_trades.map((t) => t.strategy) ?? [])
    return ['all', ...set]
  }, [data])

  const sortedTrades = useMemo(() => {
    const trades = [...(data?.completed_trades ?? [])]
    trades.sort((a, b) => b.time - a.time)
    return trades
  }, [data])

  const filteredTrades = useMemo(() => {
    return sortedTrades.filter((t) => {
      if (sideFilter !== 'all' && t.side !== sideFilter) return false
      if (strategyFilter !== 'all' && t.strategy !== strategyFilter) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (
        t.symbol.toLowerCase().includes(q) ||
        t.exchange.toLowerCase().includes(q) ||
        t.strategy.toLowerCase().includes(q) ||
        t.side.toLowerCase().includes(q) ||
        String(t.id).includes(q)
      )
    })
  }, [sortedTrades, search, sideFilter, strategyFilter])

  const exportCsv = () => {
    const rows = filteredTrades
    if (!rows.length) return
    const header = 'Time,Exchange,Symbol,Side,Quantity,Entry,Exit,PnL,Fees,Strategy,Latency,Status'
    const body = rows
      .map((t) =>
        [
          t.time_display,
          t.exchange,
          t.symbol,
          t.side,
          t.quantity,
          t.entry,
          t.exit,
          t.pnl,
          t.fees,
          t.strategy,
          t.latency_us,
          t.status,
        ].join(','),
      )
      .join('\n')
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trade-book-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const summary = data?.summary
  const session = data?.session
  const activeSymbol = session?.symbol ?? symbol
  const algoRunning = session?.algo_active ?? algoActive
  const tradeCount = summary?.trade_count ?? 0
  const hasFilters = search || sideFilter !== 'all' || strategyFilter !== 'all'

  const emptyTradeMessage = useMemo(() => {
    if (loading) return 'Loading trades…'
    if (hasFilters) return 'No trades match filters'
    if (!activeSymbol) return 'Select a stock in Paper Stock Lock and connect to start sim fills'
    if (!algoRunning) return `Connect ${activeSymbol} to run the MM algo and record simulated taker hits`
    if (tradeCount === 0) {
      return `Paper sim on ${activeSymbol} — ~1 synthetic taker fill per second while the MM algo runs`
    }
    return 'No trades yet'
  }, [loading, hasFilters, activeSymbol, algoRunning, tradeCount])

  const statusBanner = (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <span className="text-xs text-desk-muted">
        {activeSymbol
          ? `Paper MM on ${activeSymbol}${session?.exchange ? ` · ${session.exchange}` : ''} · ~1 sim fill/sec`
          : 'Live paper output — positions, orders, and time-ordered trades'}
      </span>
      {session?.strategy && (
        <span className="rounded bg-black/30 px-1.5 py-0.5 text-[9px] uppercase text-desk-muted">
          {session.strategy.replace(/_/g, ' ')}
        </span>
      )}
      {loading && <span className="text-[10px] text-desk-info">Syncing…</span>}
      {!loading && lastSync && (
        <span className="text-[10px] text-desk-muted">
          Synced {lastSync.toLocaleTimeString()} · {tradeCount} entries
        </span>
      )}
      {syncError && <span className="text-[10px] text-desk-loss">Sync failed — retrying…</span>}
      {algoRunning && !loading && (
        <span className="text-[10px] text-desk-warn">
          Algo running — ~1 fake taker hit/sec to test spread capture
        </span>
      )}
      {!loading && tradeCount > 0 && (
        <span className="text-[10px] text-desk-profit">Recording OK</span>
      )}
      <button onClick={exportCsv} className="toolbar-btn ml-auto" disabled={!filteredTrades.length}>
        <Download size={11} /> Export CSV
      </button>
    </div>
  )

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-2 overflow-auto ${embedded ? 'p-1.5' : 'p-2'}`}>
      {embedded ? (
        <div className="shrink-0 rounded border border-desk-border/40 bg-black/20">{statusBanner}</div>
      ) : (
        <GlassPanel title={activeSymbol ? `Paper Trade Book · ${activeSymbol}` : 'Paper Trade Book'} className="shrink-0">
          {statusBanner}
        </GlassPanel>
      )}

      <div className={`grid shrink-0 gap-1.5 ${embedded ? 'grid-cols-4' : 'grid-cols-7'}`}>
        <MetricCard label="Daily PnL" value={(summary?.daily_pnl ?? 0).toFixed(2)} tone={(summary?.daily_pnl ?? 0) >= 0 ? 'profit' : 'loss'} />
        <MetricCard label="Realized PnL" value={(summary?.realized_pnl ?? 0).toFixed(2)} tone="profit" />
        <MetricCard label="Unrealized PnL" value={(summary?.unrealized_pnl ?? 0).toFixed(2)} />
        <MetricCard label="Fees" value={(summary?.fees ?? 0).toFixed(2)} tone="loss" />
        <MetricCard label="Inventory" value={String(summary?.inventory ?? 0)} />
        <MetricCard label="Exposure" value={(summary?.exposure ?? 0).toFixed(2)} />
        <MetricCard label="Trade Count" value={String(summary?.trade_count ?? 0)} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
        <GlassPanel title="Open Positions" className="col-span-3 min-h-[120px]">
          <PositionTable rows={data?.open_positions ?? []} empty="No open positions" />
        </GlassPanel>
        <GlassPanel title="Open Orders" className="col-span-3 min-h-[120px]">
          <OrderTable rows={data?.open_orders ?? []} />
        </GlassPanel>
        <GlassPanel title="Filters" className="col-span-6">
          <div className="flex flex-wrap items-center gap-2 p-2">
            <div className="flex flex-1 items-center gap-1.5 rounded border border-desk-border bg-black/20 px-2 py-1">
              <Search size={12} className="text-desk-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search trades…"
                className="w-full bg-transparent text-[10px] text-desk-text outline-none"
              />
            </div>
            <select
              value={sideFilter}
              onChange={(e) => setSideFilter(e.target.value as typeof sideFilter)}
              className="rounded border border-desk-border bg-black/30 px-2 py-1 text-[10px] text-white"
            >
              <option value="all">All Sides</option>
              <option value="BID">Bid</option>
              <option value="ASK">Ask</option>
            </select>
            <select
              value={strategyFilter}
              onChange={(e) => setStrategyFilter(e.target.value)}
              className="rounded border border-desk-border bg-black/30 px-2 py-1 text-[10px] text-white"
            >
              {strategies.map((s) => (
                <option key={s} value={s}>{s === 'all' ? 'All Strategies' : s}</option>
              ))}
            </select>
          </div>
        </GlassPanel>
      </div>

      <GlassPanel title="Completed Trades" className="min-h-0 flex-1">
        <div className="h-full overflow-auto">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-desk-panel">
              <tr className="border-b border-desk-border/50 text-left uppercase text-desk-muted">
                <th className="px-2 py-1.5">Time</th>
                <th className="px-2 py-1.5">Exchange</th>
                <th className="px-2 py-1.5">Symbol</th>
                <th className="px-2 py-1.5">Side</th>
                <th className="px-2 py-1.5">Qty</th>
                <th className="px-2 py-1.5">Entry</th>
                <th className="px-2 py-1.5">Exit</th>
                <th className="px-2 py-1.5">P/L</th>
                <th className="px-2 py-1.5">Fees</th>
                <th className="px-2 py-1.5">Strategy</th>
                <th className="px-2 py-1.5">Latency</th>
                <th className="px-2 py-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-2 py-8 text-center text-desk-muted">
                    <p className="text-[11px]">{emptyTradeMessage}</p>
                    {algoRunning && activeSymbol && !hasFilters && !loading && (
                      <p className="mt-1 text-[9px] text-desk-info">
                        ~1 simulated taker fill per second crosses our quotes — correct for paper MM testing
                        (not real exchange flow). Each row logs PnL so you can see if the algo is profitable.
                      </p>
                    )}
                  </td>
                </tr>
              )}
              {filteredTrades.map((t) => (
                <tr key={t.id} className="border-b border-desk-border/20 font-mono hover:bg-desk-panel-hover/50">
                  <td className="px-2 py-1">{t.time_display}</td>
                  <td className="px-2 py-1">{t.exchange}</td>
                  <td className="px-2 py-1">{t.symbol}</td>
                  <td className={`px-2 py-1 ${t.side === 'BID' ? 'text-desk-profit' : 'text-desk-loss'}`}>{t.side}</td>
                  <td className="px-2 py-1">{t.quantity}</td>
                  <td className="px-2 py-1">{t.entry.toFixed(4)}</td>
                  <td className="px-2 py-1">{t.exit.toFixed(4)}</td>
                  <td className={`px-2 py-1 ${t.pnl >= 0 ? 'text-desk-profit' : 'text-desk-loss'}`}>{t.pnl.toFixed(4)}</td>
                  <td className="px-2 py-1">{t.fees.toFixed(4)}</td>
                  <td className="px-2 py-1">{t.strategy}</td>
                  <td className="px-2 py-1">{t.latency_us.toFixed(0)}µs</td>
                  <td className="px-2 py-1 uppercase text-desk-info">{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  )
}

function PositionTable({
  rows,
  empty,
}: {
  rows: TradeBookData['open_positions']
  empty: string
}) {
  if (!rows.length) {
    return <p className="p-3 text-center text-[10px] text-desk-muted">{empty}</p>
  }
  return (
    <table className="w-full text-[10px]">
      <thead>
        <tr className="border-b border-desk-border/50 text-left uppercase text-desk-muted">
          <th className="px-2 py-1">Symbol</th>
          <th className="px-2 py-1">Side</th>
          <th className="px-2 py-1">Qty</th>
          <th className="px-2 py-1">uPnL</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-desk-border/20 font-mono">
            <td className="px-2 py-1">{r.symbol}</td>
            <td className="px-2 py-1">{r.side}</td>
            <td className="px-2 py-1">{r.quantity}</td>
            <td className={`px-2 py-1 ${r.unrealized_pnl >= 0 ? 'text-desk-profit' : 'text-desk-loss'}`}>
              {r.unrealized_pnl.toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function OrderTable({ rows }: { rows: TradeBookData['open_orders'] }) {
  if (!rows.length) {
    return <p className="p-3 text-center text-[10px] text-desk-muted">No open orders</p>
  }
  return (
    <table className="w-full text-[10px]">
      <thead>
        <tr className="border-b border-desk-border/50 text-left uppercase text-desk-muted">
          <th className="px-2 py-1">Side</th>
          <th className="px-2 py-1">Price</th>
          <th className="px-2 py-1">Qty</th>
          <th className="px-2 py-1">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.order_id} className="border-b border-desk-border/20 font-mono">
            <td className={`px-2 py-1 ${r.side === 'BID' ? 'text-desk-profit' : 'text-desk-loss'}`}>{r.side}</td>
            <td className="px-2 py-1">{r.price.toFixed(4)}</td>
            <td className="px-2 py-1">{r.quantity}</td>
            <td className="px-2 py-1 text-desk-info">{r.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}