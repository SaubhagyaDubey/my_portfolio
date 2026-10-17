import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { CITIES, cityVars } from '../data/palette.js'
import { Board, Callsign, SubmitNote } from '../game/Board.jsx'
import { abandonRun, beginRun, finishRun, loadBoard, stopRefresh, useBoard } from '../game/board.js'
import GameScene from '../game/GameScene.jsx'
import { laneEl, laneFor, setLane } from '../game/lanes.js'
import { SPECIALS } from '../game/specials.js'
import { BOX, HULL_MAX, game, resetGame, reticleEl, useGame } from '../game/state.js'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import { navigate } from '../lib/router.js'
import { dprFor, getTier } from '../lib/tier.js'
import './play.css'

const MOVE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'])

function readParams() {
  const q = new URLSearchParams(window.location.search)
  const cityKey = q.get('city') === 'top' ? 'top' : 'under'
  // ?wave=5 jumps straight to a wave while developing
  const startWave = import.meta.env.DEV ? Math.max(1, Number(q.get('wave')) || 1) : 1
  return { cityKey, startWave }
}

// Deep Field: Impact. The ship from the galaxies, pointed down a lane full of things that don't like it.
export default function Play() {
  const { cityKey, startWave } = useMemo(() => readParams(), [])
  const city = CITIES[cityKey]
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const coarse = useMediaQuery('(pointer: coarse)')
  const wide = useMediaQuery('(min-width: 1280px)')
  const overAt = useRef(0)
  const phase = useGame((s) => s.phase)
  const cam = useGame((s) => s.cam)
  const hit = useGame((s) => s.hit)
  const flash = useGame((s) => s.flash)
  const set = useGame((s) => s.set)

  // the lane starts in the city's own colours, before the first frame draws
  useLayoutEffect(() => {
    game.city = cityKey
    setLane(laneFor(1, cityKey), true)
  }, [cityKey])

  useEffect(() => {
    game.reduced = reduced
  }, [reduced])

  useEffect(() => {
    set({ phase: 'title', banner: null, boss: null, hit: 0 })
    if (import.meta.env.DEV) window.__impact = { game, useGame }
    return () => {
      set({ phase: 'title', banner: null, boss: null })
      game.input.keys.clear()
      game.input.fire = false
    }
  }, [set])

  const start = useCallback(() => {
    beginRun(cityKey)
    resetGame(startWave)
    set({ phase: 'playing' })
  }, [set, startWave, cityKey])

  // the board loads with the page; a finished run is submitted once, when the end card appears
  useEffect(() => {
    loadBoard()
    return () => {
      abandonRun()
      stopRefresh()
    }
  }, [])
  useEffect(() => {
    if (phase !== 'over') return
    overAt.current = performance.now()
    // runs started mid-game with the dev ?wave= jump skip waves, so the board would rightly refuse them
    if (startWave === 1) finishRun({ score: game.score, wave: Math.max(1, game.wave), kills: game.kills })
    else abandonRun()
  }, [phase, startWave])
  const pause = useCallback(() => {
    if (useGame.getState().phase === 'playing') set({ phase: 'paused' })
  }, [set])
  const resume = useCallback(() => {
    if (useGame.getState().phase === 'paused') set({ phase: 'playing' })
  }, [set])
  const toggleCam = useCallback(() => set({ cam: useGame.getState().cam === 'chase' ? 'cockpit' : 'chase' }), [set])

  useEffect(() => {
    const down = (e) => {
      if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return
      const ph = useGame.getState().phase
      if (MOVE_KEYS.has(e.key)) {
        e.preventDefault()
        game.input.keys.add(e.key)
        return
      }
      if (e.key === ' ' || e.key === 'Enter') {
        if (ph === 'playing') {
          e.preventDefault()
          game.input.fire = true
          return
        }
        // a held fire key keeps repeating after the ship dies; give the end card a moment before a key restarts
        if (e.repeat || (ph === 'over' && performance.now() - overAt.current < 700)) {
          e.preventDefault()
          return
        }
        // outside play, a focused button or link handles its own Space/Enter
        if (e.target instanceof Element && e.target.closest('button, a, input, textarea, select')) return
        e.preventDefault()
        if (ph === 'title' || ph === 'over') start()
        else if (ph === 'paused') resume()
        return
      }
      if (e.key === 'Shift') game.input.roll = true
      else if ((e.key === 'e' || e.key === 'E') && ph === 'playing') game.input.special = true
      else if (e.key === 'v' || e.key === 'V') toggleCam()
      else if (e.key === 'p' || e.key === 'P') {
        if (ph === 'paused') resume()
        else pause()
      }
      else if (e.key === 'Escape') {
        if (ph === 'playing') pause()
        else if (ph === 'paused') resume()
        else navigate('/')
      }
    }
    const up = (e) => {
      game.input.keys.delete(e.key)
      if (e.key === ' ') game.input.fire = false
    }
    const blur = () => {
      game.input.keys.clear()
      game.input.fire = false
      pause()
    }
    const hidden = () => {
      if (document.hidden) blur()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [start, pause, resume, toggleCam])

  // pointer: position steers, holding fires. Touch aims a little above the finger so the ship stays visible.
  const aim = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1
    const ny = -(((e.clientY - r.top) / r.height) * 2 - 1) + (e.pointerType === 'touch' ? 0.28 : 0)
    game.input.tx = Math.max(-BOX.x, Math.min(BOX.x, nx * BOX.x * 1.2))
    game.input.ty = Math.max(-BOX.y, Math.min(BOX.y, ny * BOX.y * 1.3))
  }
  const onPointerDown = (e) => {
    if (useGame.getState().phase !== 'playing') return
    if (e.pointerType === 'mouse' && e.button === 2) {
      game.input.special = true
      return
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return
    aim(e)
    game.input.fire = true
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // capture can be refused; steering still works
    }
  }
  const onPointerMove = (e) => {
    if (e.pointerType === 'touch' && !game.input.fire) return
    if (useGame.getState().phase === 'playing') aim(e)
  }
  const onPointerUp = () => {
    game.input.fire = false
  }

  return (
    <div
      className="play"
      data-phase={phase}
      data-cam={cam}
      style={cityVars(cityKey)}
      ref={(el) => {
        laneEl.current = el
      }}
    >
      <div
        className="play__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Canvas
          dpr={[1, dprFor(getTier())]}
          camera={{ fov: 60, near: 0.05, far: 4000, position: [0, 2.2, 9.6] }}
          gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
        >
          <GameScene city={city} cityKey={cityKey} reduced={reduced} />
        </Canvas>
      </div>

      {cam === 'cockpit' ? <div className="play__cockpit" aria-hidden="true" /> : null}
      <div
        className="play__reticle"
        aria-hidden="true"
        ref={(el) => {
          reticleEl.current = el
        }}
      />
      {hit > 0 ? <div key={hit} className="play__hit" aria-hidden="true" /> : null}
      {flash > 0 ? <div key={flash} className="play__flash" aria-hidden="true" /> : null}

      <Hud onPause={pause} onCam={toggleCam} coarse={coarse} />
      <Banner />
      <BossBar />
      <Rack coarse={coarse} />
      <Toast coarse={coarse} />
      {coarse && phase === 'playing' ? (
        <button
          className="play__roll"
          onPointerDown={(e) => {
            e.stopPropagation()
            game.input.roll = true
          }}
        >
          roll
        </button>
      ) : null}

      {phase === 'title' ? <Title onStart={start} coarse={coarse} reduced={reduced} cityKey={cityKey} wide={wide} /> : null}
      {phase === 'paused' ? <Paused onResume={resume} onRestart={start} /> : null}
      {phase === 'over' ? <Over onRestart={start} wide={wide} /> : null}
      {wide && phase !== 'playing' ? (
        <aside className="play__side">
          <Board />
        </aside>
      ) : null}
    </div>
  )
}

function Hud({ onPause, onCam, coarse }) {
  const score = useGame((s) => s.score)
  const hull = useGame((s) => s.hull)
  const wave = useGame((s) => s.wave)
  const mult = useGame((s) => s.mult)
  const cam = useGame((s) => s.cam)
  const phase = useGame((s) => s.phase)
  const live = phase === 'playing' || phase === 'paused'
  return (
    <header className="play__hud" data-live={live}>
      <div className="play__hud-left">
        <button className="play__back" onClick={() => navigate('/')} aria-label="back to the start">
          the start
        </button>
        {live ? <span className="play__wave">wave {String(wave).padStart(2, '0')}</span> : null}
      </div>
      {live ? (
        <div className="play__score" aria-live="off">
          <b>{String(score).padStart(7, '0')}</b>
          {mult > 1 ? <span className="play__mult">×{mult}</span> : null}
        </div>
      ) : (
        <div className="play__score" />
      )}
      <div className="play__hud-right">
        {live ? (
          <span className="play__hull" aria-label={`hull ${hull} of ${HULL_MAX}`}>
            {Array.from({ length: HULL_MAX }, (_, i) => (
              <i key={i} data-on={i < hull} />
            ))}
          </span>
        ) : null}
        <button onClick={onCam} aria-pressed={cam === 'cockpit'} title="switch view (v)">
          {cam === 'cockpit' ? 'cockpit' : 'chase'}
          {coarse ? '' : ' · v'}
        </button>
        {live ? (
          <button onClick={onPause} title="pause (p)">
            pause
          </button>
        ) : null}
      </div>
    </header>
  )
}

// Every power-up the ship has, in one row under the HUD: pickup weapons waiting to fire (the first one
// goes next), then twin cannons and the upgrades it's carrying. On touch the rack itself is the fire button.
function Rack({ coarse }) {
  const held = useGame((s) => s.held)
  const twin = useGame((s) => s.twin)
  const shield = useGame((s) => s.shield)
  const wind = useGame((s) => s.wind)
  const phase = useGame((s) => s.phase)
  if (phase !== 'playing' && phase !== 'paused') return null
  const rack = held ? held.split(' ') : []
  if (!rack.length && !twin && !shield && !wind) return null
  return (
    <div className="play__rack">
      {rack.length ? (
        <button
          className="play__fire"
          tabIndex={-1}
          aria-label={`fire ${SPECIALS[rack[0]].label}`}
          onPointerDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
            game.input.special = true
          }}
        >
          {coarse ? null : <kbd>e</kbd>}
          {rack.map((k, i) => (
            <span key={i} data-next={i === 0} style={{ '--kind': SPECIALS[k].color }}>
              {SPECIALS[k].label}
            </span>
          ))}
        </button>
      ) : null}
      {twin ? (
        <span className="play__perk play__perk--timed" style={{ '--kind': 'var(--glow)' }}>
          twin cannons
        </span>
      ) : null}
      {shield ? <span className="play__perk" style={{ '--kind': SPECIALS.shield.color }}>{SPECIALS.shield.label}</span> : null}
      {wind ? <span className="play__perk" style={{ '--kind': SPECIALS.wind.color }}>{SPECIALS.wind.label}</span> : null}
    </div>
  )
}

// One line when a pickup lands: what it is, what it does, how to fire it.
function Toast({ coarse }) {
  const toast = useGame((s) => s.toast)
  const phase = useGame((s) => s.phase)
  if (!toast || phase !== 'playing') return null
  const sp = SPECIALS[toast.kind]
  const how = sp.type === 'weapon' ? (coarse ? 'tap the rack to fire' : 'e or right-click to fire') : null
  return (
    <div className="play__toast" key={toast.key} style={{ '--kind': sp.color }} aria-live="polite">
      <b>{toast.full ? 'rack full' : sp.label}</b>
      <span>{toast.full ? `no room for the ${sp.label}. fire one first.` : how ? `${sp.hint} · ${how}` : sp.hint}</span>
    </div>
  )
}

function Banner() {
  const banner = useGame((s) => s.banner)
  if (!banner) return null
  return (
    <div className="play__banner" key={banner.key} aria-live="polite">
      <b>{banner.text}</b>
      {banner.sub ? <span>{banner.sub}</span> : null}
    </div>
  )
}

function BossBar() {
  const boss = useGame((s) => s.boss)
  const phase = useGame((s) => s.phase)
  if (boss === null || phase === 'over' || phase === 'title') return null
  return (
    <div className="play__boss" aria-label="leviathan health">
      <span>leviathan</span>
      <i style={{ '--hp': boss }} />
    </div>
  )
}

function Title({ onStart, coarse, reduced, cityKey, wide }) {
  const best = useGame((s) => s.best)
  const hasBoard = useBoard((s) => s.entries.length > 0)
  const other = cityKey === 'top' ? 'under' : 'top'
  return (
    <div className="play__card play__card--title">
      <p className="play__kicker mono">a side quest from deep field</p>
      <h1 className="play__logo">
        <span>deep field</span>
        <b>impact</b>
      </h1>
      <p className="play__lede">
        the same ship from the galaxies, pointed down a lane full of things that don&apos;t like it. shoot the glowing bits. remember space impact on the old nokia? this is that, from behind the ship.
      </p>
      <ul className="play__controls mono">
        {coarse ? (
          <>
            <li>
              <b>drag</b> to steer and fire
            </li>
            <li>
              <b>roll</b> button: you can&apos;t be hit mid-roll
            </li>
            <li>
              tap the <b>rack</b> to fire a pickup weapon
            </li>
          </>
        ) : (
          <>
            <li>
              <b>mouse</b>, <b>wasd</b> or <b>arrows</b> to steer
            </li>
            <li>
              hold <b>click</b> or <b>space</b> to fire
            </li>
            <li>
              <b>shift</b> to roll: you can&apos;t be hit mid-roll
            </li>
            <li>
              <b>e</b> or <b>right-click</b> fires a pickup weapon
            </li>
            <li>
              <b>v</b> cockpit view · <b>p</b> pause
            </li>
          </>
        )}
      </ul>
      <button className="play__start" onClick={onStart} autoFocus>
        launch
      </button>
      {wide ? null : (
        <>
          {hasBoard ? <Board compact /> : null}
          <Callsign />
        </>
      )}
      <p className="play__meta mono">
        {best > 0 ? <span>best {String(best).padStart(7, '0')}</span> : <span>no best score yet</span>}
        {reduced ? <span>calm mode: slower lane, no shake</span> : null}
        <a
          href={`/play?city=${other}`}
          onClick={(e) => {
            e.preventDefault()
            window.location.assign(`/play?city=${other}`)
          }}
        >
          fly it {other === 'top' ? 'topside' : 'in the undercity'}
        </a>
      </p>
    </div>
  )
}

function Paused({ onResume, onRestart }) {
  return (
    <div className="play__card">
      <h2 className="play__card-title">paused</h2>
      <div className="play__row">
        <button className="play__start" onClick={onResume} autoFocus>
          resume
        </button>
        <button className="play__ghost" onClick={onRestart}>
          restart
        </button>
        <button className="play__ghost" onClick={() => navigate('/')}>
          back to the start
        </button>
      </div>
    </div>
  )
}

function Over({ onRestart, wide }) {
  const score = useGame((s) => s.score)
  const best = useGame((s) => s.best)
  const wave = useGame((s) => s.wave)
  const fresh = score > 0 && score >= best
  return (
    <div className="play__card">
      <p className="play__kicker mono">hull gone · wave {wave}</p>
      <h2 className="play__card-title play__card-title--score">{String(score).padStart(7, '0')}</h2>
      <p className="play__lede">{fresh ? 'new best. not bad at all.' : `best is ${String(best).padStart(7, '0')}. one more go?`}</p>
      <SubmitNote />
      {wide ? null : <Board compact />}
      <div className="play__row">
        <button className="play__start" onClick={onRestart} autoFocus>
          fly again
        </button>
        <button className="play__ghost" onClick={() => navigate('/')}>
          back to the start
        </button>
      </div>
    </div>
  )
}
