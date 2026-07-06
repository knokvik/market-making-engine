import { useEffect } from 'react'

interface ShortcutHandlers {
  onPlayPause: () => void
  onStepForward: () => void
  onStepBackward: () => void
  onReset: () => void
  onToggleFullscreen?: () => void
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return

      if (e.code === 'Space') {
        e.preventDefault()
        handlers.onPlayPause()
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        handlers.onStepForward()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        handlers.onStepBackward()
      } else if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        handlers.onReset()
      } else if (e.key === 'f' && e.shiftKey) {
        handlers.onToggleFullscreen?.()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers, enabled])
}