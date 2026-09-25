import type { ReactNode } from 'react'

// Enter-only CSS animation (.page-enter in index.css). There is no JS animation
// loop to wait on, so a route change can never stall behind a transition, and
// prefers-reduced-motion is honored by the global rule in index.css.
export function PageTransition({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>
}
