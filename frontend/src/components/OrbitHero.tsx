// Decorative orbital diagram. It is NOT driven by data — the caption says so.
// It uses no real coordinates and represents no specific object.
export function OrbitHero({ className = '' }: { className?: string }) {
  return (
    <figure className={className}>
      <svg viewBox="0 0 400 300" role="img" aria-label="Illustrative diagram of an orbital path and a close approach to Earth. Not real data." className="w-full">
        <defs>
          <radialGradient id="earth-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Tick marks along the outer ring — a measurement motif */}
        <g className="orbit-drift" stroke="rgb(255 255 255 / 0.12)">
          {Array.from({ length: 72 }, (_, i) => {
            const a = (i / 72) * Math.PI * 2
            const long = i % 6 === 0
            const r1 = 138
            const r2 = long ? 128 : 133
            return <line key={i} x1={200 + Math.cos(a) * r1} y1={150 + Math.sin(a) * r1} x2={200 + Math.cos(a) * r2} y2={150 + Math.sin(a) * r2} />
          })}
        </g>
        <ellipse cx="200" cy="150" rx="118" ry="46" fill="none" stroke="rgb(255 255 255 / 0.14)" strokeDasharray="2 5" transform="rotate(-18 200 150)" />
        <ellipse cx="200" cy="150" rx="86" ry="86" fill="none" stroke="rgb(255 255 255 / 0.07)" />
        <ellipse cx="200" cy="150" rx="54" ry="54" fill="none" stroke="rgb(255 255 255 / 0.07)" />

        {/* Trajectory arc passing Earth */}
        <path d="M 40 232 Q 190 96 360 78" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.85" />
        <circle cx="132" cy="150" r="3.5" fill="#38bdf8" />
        <text x="140" y="142" className="fill-accent font-mono text-[9px] uppercase tracking-wider">
          object
        </text>

        {/* Distance indicator */}
        <line x1="200" y1="150" x2="132" y2="150" stroke="rgb(255 255 255 / 0.35)" strokeDasharray="1 3" />
        <text x="150" y="170" className="fill-muted font-mono text-[9px] uppercase tracking-wider">
          distance
        </text>

        {/* Earth */}
        <circle cx="200" cy="150" r="34" fill="url(#earth-glow)" />
        <circle cx="200" cy="150" r="9" fill="#0f1626" stroke="#38bdf8" strokeWidth="1.5" />
        <text x="200" y="182" textAnchor="middle" className="fill-muted font-mono text-[9px] uppercase tracking-wider">
          earth
        </text>
      </svg>
      <figcaption className="mt-1 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
        Illustrative visualization — not real data
      </figcaption>
    </figure>
  )
}
