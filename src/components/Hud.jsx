import { navigate } from '../lib/router.js'
import { useStore } from '../state/store.js'

export function Hud({ world }) {
  return (
    <div className="hud mono">
      <button className="hud__back" onClick={() => navigate('/')}>
        the start
      </button>
      <span className="hud__world">{world.label}</span>
      <span className="hud__links">
        <a
          className="hud__play"
          href={`/play?city=${world.key}`}
          onClick={(e) => {
            e.preventDefault()
            navigate(`/play?city=${world.key}`)
          }}
        >
          play
        </a>
        <a
          href="/text"
          onClick={(e) => {
            e.preventDefault()
            navigate('/text')
          }}
        >
          read it as text
        </a>
      </span>
    </div>
  )
}

export function Hint() {
  const moved = useStore((s) => s.moved)
  const docked = useStore((s) => s.docked)
  return (
    <div className="hint" data-hide={moved || Boolean(docked)} aria-hidden={moved || Boolean(docked)}>
      hold and drag to fly, or tap a flag.
      <br />
      <span>arrow keys work too. the dotted line is the story in order.</span>
    </div>
  )
}
