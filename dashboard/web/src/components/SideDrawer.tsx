import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'

const EASE = [0.22, 1, 0.36, 1] as const

interface SideDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string
}

export function SideDrawer({ open, onClose, title, children, width = 'min(420px, 38vw)' }: SideDrawerProps) {
  const isMobile = useIsMobile()
  const drawerWidth = isMobile ? '100%' : width

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="absolute inset-0 z-40 h-full bg-black/45 backdrop-blur-[1px]"
            onClick={onClose}
          />
          <motion.aside
            key="panel"
            initial={{ x: '100%', opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.6 }}
            transition={{ duration: 0.42, ease: EASE }}
            className={`absolute inset-y-0 right-0 z-[60] flex h-full flex-col overflow-hidden border border-l border-desk-border bg-desk-bg shadow-[-8px_0_32px_rgba(0,0,0,0.45)]${isMobile ? '' : ' rounded-l-2xl'}`}
            style={{ width: drawerWidth, height: '100%' }}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-desk-border px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-desk-text">{title}</span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-desk-border p-1.5 text-desk-muted transition hover:text-desk-text"
              >
                <X size={14} />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}