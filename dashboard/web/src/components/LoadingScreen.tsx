import { Logo } from './ui/Logo'

interface LoadingScreenProps {
  overlay?: boolean
}

export function LoadingScreen({ overlay = false }: LoadingScreenProps) {
  return (
    <div
      className={
        overlay
          ? 'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-desk-bg/95 backdrop-blur-sm'
          : 'flex h-screen flex-col items-center justify-center bg-desk-bg'
      }
      aria-live="polite"
      aria-busy="true"
    >
      <Logo size={64} />
      <p className="mt-4 text-sm font-medium text-desk-text">Quant Research Platform</p>
      <p className="mt-1 text-xs text-desk-muted">Initializing workstation…</p>
      <div className="mt-6 h-0.5 w-40 overflow-hidden rounded-full bg-desk-border">
        <div className="h-full w-full origin-left animate-[loading-bar_1s_ease-in-out_forwards] rounded-full bg-desk-info" />
      </div>
    </div>
  )
}