import { useEffect, useState } from 'react'

const BOOT_MS = 1000

/** Show initializing screen on every page load / reload. */
export function useDailyBoot(_connected: boolean) {
  const [showBoot, setShowBoot] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowBoot(false), BOOT_MS)
    return () => clearTimeout(timer)
  }, [])

  return showBoot
}