import { flagEls, flyTo, useStore } from '../state/store.js'

// One flag per stop: an engraved plate with the name and one plain fact (who, what, when, where),
// and a pin down to the object.
// Positioned every frame by Simulation; clamped to the screen edge with an arrow when off-screen.
export default function Flags({ world }) {
  const visited = useStore((s) => s.visited[world.key] ?? [])
  const docked = useStore((s) => s.docked)
  const target = useStore((s) => s.target)
  return (
    <div className="flags">
      {world.stops.map((s) => (
        <button
          key={s.id}
          className="flag"
          data-kind={s.kind}
          data-visited={visited.includes(s.id)}
          data-active={docked === s.id || target === s.id}
          ref={(el) => {
            if (el) flagEls.set(s.id, el)
            else flagEls.delete(s.id)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => flyTo(s.id)}
          aria-label={`fly to ${s.title}`}
        >
          <span className="flag__label">
            <b data-full="">{s.title}</b>
            <b data-short="">{s.short ?? s.title}</b>
            <small>{s.fact ?? s.tag}</small>
          </span>
          <span className="flag__arrow" aria-hidden="true" />
          <span className="flag__pin" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
