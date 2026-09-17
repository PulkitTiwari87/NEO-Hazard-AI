import { NavLink } from 'react-router-dom'

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
    <header className="border-b border-white/10 bg-[#070b14]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <span className="text-sm font-semibold tracking-wide text-slate-100">
          NEO-Hazard-AI <span className="text-slate-500">— research ML pipeline</span>
        </span>
        <nav className="flex flex-wrap gap-1 text-sm">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 transition-colors ${
                  isActive ? 'bg-sky-500/15 text-sky-300' : 'text-slate-400 hover:text-slate-100'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
