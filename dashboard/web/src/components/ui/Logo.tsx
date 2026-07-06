import clsx from 'clsx'
import { motion } from 'framer-motion'

interface LogoProps {
  size?: number
  className?: string
  showText?: boolean
}

export function Logo({ size = 28, className, showText = false }: LogoProps) {
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <motion.div
        className="relative shrink-0"
        style={{ width: size, height: size }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-md bg-desk-profit/25 blur-md"
          animate={{ opacity: [0.15, 0.5, 0.15], scale: [0.85, 1.2, 0.85] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        />
        <motion.img
          src="/logo.png"
          alt="Quant Research Platform"
          width={size}
          height={size}
          className="relative rounded-md object-contain"
          animate={{
            filter: [
              'drop-shadow(0 0 0px rgba(68,255,137,0))',
              'drop-shadow(0 0 10px rgba(68,255,137,0.45))',
              'drop-shadow(0 0 0px rgba(68,255,137,0))',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
      {showText && (
        <motion.span
          className="text-sm font-semibold tracking-tight text-desk-text"
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          Quant Research Platform
        </motion.span>
      )}
    </div>
  )
}