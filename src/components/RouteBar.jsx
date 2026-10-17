import { flyTo, useStore } from '../state/store.js'

// The flight plan as a strip of dots. Filled when visited, ringed when current. Click to fly there.
export default function RouteBar({ world }) {
  const visited = useStore((s) => s.visited[world.key] ?? [])
  const docked = useStore((s) => s.docked)
  const target = useStore((s) => s.target)
  const stops = world.stops
  const total = stops.filter((s) => s.kind !== 'gate').length
  const found = visited.filter((id) => stops.some((s) => s.id === id && s.kind !== 'gate')).length
  return (
    <nav className="route mono" aria-label="route">
      <ol>
        {stops.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => flyTo(s.id)}
              data-visited={visited.includes(s.id)}
              data-current={docked === s.id || target === s.id}
              data-kind={s.kind}
              title={s.fact ? `${s.title} — ${s.fact}` : s.title}
              aria-label={`fly to ${s.title}`}
            >
              <span className="route__dot" aria-hidden="true" />
              <span className="route__name">{s.kind === 'gate' ? (s.to === 'top' ? 'topside' : 'undercity') : (s.short ?? s.title)}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="route__count mono" aria-live="polite">
        {found} / {total}
      </div>
    </nav>
  )
}
