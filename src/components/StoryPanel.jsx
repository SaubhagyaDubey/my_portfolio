import { useLayoutEffect, useRef } from 'react'
import { CONTACT, nextStop, routeOf } from '../data/worlds.js'
import { warpTo } from '../lib/warp.js'
import { flyTo, sim, useStore } from '../state/store.js'

const pad = (n) => String(n).padStart(2, '0')

// Sizes the poster title to the space it has: the largest size where no word overflows the column, the
// title takes at most 60% of the column's height and the kicker and title together fit in it. The kicker
// is shrunk to one line first, if it can be. Runs again once Archivo has loaded: the fallback is narrower.
// Overflow is read off the text itself, not scrollWidth: the title's hatched shadows hang past its box.
function useFit(ref, key) {
  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const set = box.firstElementChild
    const [kicker, title] = set.children
    const ink = document.createRange()
    ink.selectNodeContents(title)
    const fit = () => {
      kicker.style.whiteSpace = 'nowrap'
      kicker.style.fontSize = ''
      const base = parseFloat(getComputedStyle(kicker).fontSize)
      kicker.style.fontSize = `${Math.max(12, base * Math.min(1, kicker.clientWidth / kicker.scrollWidth))}px`
      kicker.style.whiteSpace = ''
      let lo = 28
      let hi = Math.min(window.innerHeight * 0.24, 240)
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2
        title.style.fontSize = `${mid}px`
        const fits =
          ink.getBoundingClientRect().right <= title.getBoundingClientRect().right + 1 &&
          title.offsetHeight <= box.clientHeight * 0.6 &&
          set.offsetHeight <= box.clientHeight
        if (fits) lo = mid
        else hi = mid
      }
      title.style.fontSize = `${lo}px`
    }
    let live = true
    fit()
    const fonts = document.fonts
    if (fonts) {
      Promise.all([fonts.load('800 100px "Archivo Variable"'), fonts.load('400 20px "Archivo Variable"')]).then(() => live && fit())
    }
    window.addEventListener('resize', fit)
    return () => {
      live = false
      window.removeEventListener('resize', fit)
    }
  }, [ref, key])
}

// The docked stop's name, set like a film poster over the scene: a widely tracked kicker over one heavy
// word. Rendered over the flags; it takes no pointer events, so a flag behind it still takes a click.
export function StoryPoster({ world }) {
  const docked = useStore((s) => s.docked)
  const stop = world.stops.find((s) => s.id === docked)
  const ref = useRef(null)
  useFit(ref, stop?.id)
  if (!stop) return null
  return (
    <div className="poster" key={stop.id} ref={ref}>
      <div className="poster__set">
        <p className="poster__kicker">{stop.tag}</p>
        <h2 className="poster__title" id="story-title" data-text={stop.title}>
          <span className="poster__ink">{stop.title}</span>
        </h2>
      </div>
    </div>
  )
}

// Opens by itself when the ship reaches a stop. Whole story visible at once; one button to fly on.
export default function StoryPanel({ world }) {
  const docked = useStore((s) => s.docked)
  const undock = useStore((s) => s.undock)
  const stop = world.stops.find((s) => s.id === docked)
  if (!stop) return null

  const route = routeOf(world.key)
  const index = route.findIndex((s) => s.id === stop.id)
  const next = nextStop(world.key, stop.id)
  const close = () => {
    sim.leftId = stop.id
    undock()
  }

  return (
    <aside className="story" key={stop.id} aria-live="polite" aria-labelledby="story-title">
      <header>
        <div>
          <div className="story__where mono">{index >= 0 ? `${pad(index + 1)} / ${pad(route.length)}` : 'the gate'}</div>
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
