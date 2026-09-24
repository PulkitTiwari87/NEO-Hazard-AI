import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'

const links = [
  { to: '/', label: 'Overview' },
  { to: '/data', label: 'Data Provenance' },
  { to: '/explorer', label: 'NEO Explorer' },
  { to: '/feature-audit', label: 'Feature Audit' },
  { to: '/experiments', label: 'Experiments' },
  { to: '/original-experiment', label: 'Experiment A (Original)' },
  { to: '/reproducibility', label: 'Reproducibility' },
  { to: '/limitations', label: 'Limitations' },
]

export function Nav() {
  return (
    // Translucent material, not an opaque bar — content scrolls underneath.
    // Bright top hairline reads as light catching the material's edge.
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070b14]/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <span className="text-sm font-semibold tracking-tight text-slate-100">
          NEO-Hazard-AI <span className="font-normal tracking-normal text-slate-500">— research ML pipeline</span>
        </span>
        <nav className="flex flex-wrap gap-1 text-sm">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className="relative rounded-md px-3 py-1.5 transition-colors">
              {({ isActive }) => (
                <motion.span
                  className="relative z-10 block"
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', damping: 1, duration: 0.15 }}
                >
                  {isActive && (
                    // Shared layoutId: the pill glides between tabs instead
                    // of popping — spatial consistency, apple-design §7.
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-0 -z-10 rounded-md bg-sky-500/15"
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }}
                    />
                  )}
                  <span className={isActive ? 'text-sky-300' : 'text-slate-400 hover:text-slate-100'}>
                    {link.label}
                  </span>
                </motion.span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
