import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

// Critically damped (no overshoot) — a page swap isn't a momentum
// gesture, so bounce would read as wrong per apple-design §4.
const spring = { type: 'spring' as const, damping: 1, duration: 0.35 }

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={spring}
    >
      {children}
    </motion.div>
  )
}
