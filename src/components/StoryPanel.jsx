import { CONTACT, nextStop, routeOf } from '../data/worlds.js'
import { usePortrait } from '../data/portrait.js'
import { warpTo } from '../lib/warp.js'
import { flyTo, sim, useStore } from '../state/store.js'

// Opens by itself when the ship reaches a stop. Whole story visible at once; one button to fly on.
export default function StoryPanel({ world }) {
  const docked = useStore((s) => s.docked)
  const undock = useStore((s) => s.undock)
  const stop = world.stops.find((s) => s.id === docked)
  const face = usePortrait(stop?.face ?? 'front')
  if (!stop) return null

  const route = routeOf(world.key)
  const index = route.findIndex((s) => s.id === stop.id)
  const next = nextStop(world.key, stop.id)
  const close = () => {
    sim.leftId = stop.id
    undock()
  }

  return (
    <aside className="story" key={stop.id} aria-live="polite" aria-label={stop.title}>
      <header>
        <div className="story__face" aria-hidden="true">
          <img src={face} alt="" />
        </div>
        <div>
          <div className="story__where mono">{index >= 0 ? `${index + 1} / ${route.length} · ${stop.tag}` : stop.tag}</div>
          <h2>{stop.title}</h2>
          {stop.fact ? <div className="story__fact mono">{stop.fact}</div> : null}
        </div>
        <button className="story__close" onClick={close} aria-label="close">
          ×
        </button>
      </header>
      {stop.story.map((p) => (
        <p key={p.slice(0, 24)}>{p}</p>
      ))}
      {stop.contact ? (
        <div className="contact mono">
          <span>{CONTACT.email}</span>
          <span>
            <a href={CONTACT.linkedin} target="_blank" rel="noreferrer">
              linkedin
            </a>
            {' · '}
            <a href={CONTACT.github} target="_blank" rel="noreferrer">
              github
            </a>
          </span>
        </div>
      ) : null}
      <footer>
        {stop.kind === 'gate' ? (
          <>
            <button className="btn btn--primary" onClick={(e) => warpTo(`/${stop.to}`, { x: e.clientX, y: e.clientY })}>
              go through →
            </button>
            <button className="btn" onClick={close}>
              not yet
            </button>
          </>
        ) : next ? (
          <button className="btn btn--primary" onClick={() => flyTo(next.id)}>
            {next.kind === 'gate' ? `on to the gate →` : `next: ${next.title} →`}
          </button>
        ) : null}
      </footer>
    </aside>
  )
}
