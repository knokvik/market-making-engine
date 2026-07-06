import type { LayoutItem } from 'react-grid-layout/legacy'

export function layoutExtent(items: LayoutItem[]): number {
  return items.reduce((max, item) => Math.max(max, (item.y ?? 0) + (item.h ?? 1)), 0)
}

function collides(a: LayoutItem, b: LayoutItem): boolean {
  if (a.i === b.i) return false
  const ax = a.x ?? 0
  const ay = a.y ?? 0
  const bx = b.x ?? 0
  const by = b.y ?? 0
  const aw = a.w ?? 1
  const ah = a.h ?? 1
  const bw = b.w ?? 1
  const bh = b.h ?? 1
  if (ax + aw <= bx) return false
  if (ax >= bx + bw) return false
  if (ay + ah <= by) return false
  if (ay >= by + bh) return false
  return true
}

/** Pack panels upward — removes vertical gaps after drag/resize. */
export function compactLayoutVertical(items: LayoutItem[]): LayoutItem[] {
  const sorted = [...items].sort(
    (a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0),
  )
  const placed: LayoutItem[] = []

  for (const item of sorted) {
    let y = item.y ?? 0
    let candidate = { ...item, y }

    while (y > 0) {
      const test = { ...candidate, y: y - 1 }
      if (placed.some((p) => collides(test, p))) break
      y -= 1
      candidate = test
    }

    while (placed.some((p) => collides(candidate, p))) {
      y += 1
      candidate = { ...item, y }
    }

    placed.push(candidate)
  }

  return placed
}

export function computeAdaptiveRowHeight(
  containerHeight: number,
  rows: number,
  baseRowHeight: number,
  margin: number,
  padding = 16,
): { rowHeight: number; fillsViewport: boolean } {
  if (rows <= 0 || containerHeight <= 0) {
    return { rowHeight: baseRowHeight, fillsViewport: false }
  }

  const margins = margin * Math.max(0, rows - 1)
  const natural = rows * baseRowHeight + margins + padding

  if (natural >= containerHeight - 4) {
    return { rowHeight: baseRowHeight, fillsViewport: false }
  }

  const available = containerHeight - padding - margins
  const expanded = Math.floor(available / rows)
  return {
    rowHeight: Math.max(baseRowHeight, Math.min(68, expanded)),
    fillsViewport: true,
  }
}