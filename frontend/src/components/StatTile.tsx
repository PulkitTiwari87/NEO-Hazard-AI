import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

const tileVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

// Wrap a set of <StatTile>s in this to stagger their entrance — each tile
// animates in slightly after the last, reading as one considered reveal
// rather than a pop. Damping 1.0 (critically damped): a data tile
// appearing isn't a momentum gesture, so no overshoot (apple-design §4).
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.04 } } }}
    >
      {children}
    </motion.div>
  )
}

export function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <motion.div
      variants={tileVariants}
      transition={{ type: 'spring', damping: 1, duration: 0.35 }}
      whileHover={{ y: -2 }}
      className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">{value}</p>
    </motion.div>
  )
}
