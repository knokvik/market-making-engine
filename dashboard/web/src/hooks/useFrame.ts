import { createContext, useContext } from 'react'
import type { ReplayFrame } from '../types'

export const FrameContext = createContext<ReplayFrame | null>(null)

export function useFrame(): ReplayFrame | null {
  return useContext(FrameContext)
}