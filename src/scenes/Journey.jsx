import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { BASE, CITIES, cityVars } from '../data/palette.js'
import { FORK, JOURNEY, READY } from '../data/journey.js'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import { FOV, GRACE, cardOf, createJourney, dwellFor, forkShown, leave, next, progress, restart, toFork } from '../lib/journey.js'
import { navigate, searchParam } from '../lib/router.js'
import { dprFor, getTier } from '../lib/tier.js'
import { warpTo } from '../lib/warp.js'
import { EARTH_TEXTURES } from '../three/Planet.jsx'
import JourneyScene from '../three/JourneyScene.jsx'
import '../styles/poster.css'
import './journey.css'

const N = JOURNEY.length
const DWELLS = JOURNEY.map(dwellFor)
const SEEN_KEY = 'deepfield.journey.v1'
const pad = (n) => String(n).padStart(2, '0')

// the name's card and the fork belong to neither city: steel light, and one shadow from each
const OPEN_VARS = {
  '--accent': BASE.steel,
  '--accent2': '#dce8ff',
  '--glow': '#e4efff',
  '--shade-a': CITIES.under.shade[0],
  '--shade-b': CITIES.top.shade[1],
}

// The ride plays once per tab session; after that the home page opens at the fork.
// ?journey=1 rides again, ?journey=0 goes straight to the fork.
let rode = false
function startAtFork() {
  const p = searchParam('journey')
  if (p === '1') return false
  if (p === '0') return true
  if (rode) return true
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}
function markRode() {
  rode = true
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    // storage may be unavailable; the module flag still covers this visit
  }
}

const riding = (phase) => phase === 'ready' || phase === 'fly' || phase === 'dwell'
const typing = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
// a link or button handles its own clicks and keys; the take-off ring is the exception, it holds like the page
const onControl = (t) => t instanceof Element && Boolean(t.closest('a, button:not(.journey-ignite)'))

// The home page: the cockpit of the ship from the game. Hold space (or click) and it takes off, stops five
// times with one card each in the middle of the canopy, and ends at a fork: me, the work, or the game.
export default function Journey() {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)')
  const j = useRef(null)
  if (j.current === null) {
    j.current = createJourney(N, { fork: startAtFork(), reduced })
    Object.assign(j.current, { mouse: { x: 0.5, y: 0.5 }, pointer: false, hover: null, anchors: {} })
  }
  const [view, setView] = useState(() => ({ phase: j.current.phase, i: j.current.i, card: null, last: null, fork: forkShown(j.current), leaving: null }))
  const viewRef = useRef(view)
  const blinkRef = useRef(null)
  const press = useRef(null)
  const discs = useRef({})

  // per-frame DOM: the route's fill, the take-off ring, the card's countdown. Each resets when its element changes.
  const els = useRef({ route: null, charge: null, timer: null, p: -1, c: -1, w: -1 })
  const routeRef = useCallback((el) => {
    Object.assign(els.current, { route: el, p: -1 })
  }, [])
  const chargeRef = useCallback((el) => {
    Object.assign(els.current, { charge: el, c: -1 })
  }, [])
  const timerRef = useCallback((el) => {
    Object.assign(els.current, { timer: el, w: -1 })
  }, [])
  const discRefs = useMemo(() => {
    const at = (key) => (el) => {
      discs.current[key] = el
    }
    return { under: at('under'), top: at('top'), play: at('play') }
  }, [])

  useEffect(() => {
    j.current.reduced = reduced
  }, [reduced])

  useEffect(() => {
    if (j.current.phase === 'fork') markRode()
    useLoader.preload(THREE.TextureLoader, EARTH_TEXTURES)
    if (import.meta.env.DEV) window.__journey = j
  }, [])

  // Called by the scene every frame, and after any input: re-renders only when the phase, stop, card or fork change.
  const tick = useCallback(() => {
    const s = j.current
    const v = viewRef.current
    const card = cardOf(s)
    const fork = forkShown(s)
    if (s.phase !== v.phase || s.i !== v.i || card !== v.card || fork !== v.fork) {
      const nv = { phase: s.phase, i: s.i, card, last: card ?? v.last, fork, leaving: s.phase === 'leave' ? s.leaveKey : null }
      viewRef.current = nv
      setView(nv)
    }
    const e = els.current
    const p = progress(s)
    if (e.route && Math.abs(p - e.p) > 0.0005) {
      e.route.style.transform = `scaleX(${p.toFixed(4)})`
      e.p = p
    }
    if (e.charge && s.charge !== e.c) {
      e.charge.style.strokeDashoffset = String(1 - s.charge)
      e.c = s.charge
    }
    const w = s.phase === 'dwell' ? Math.max(0, 1 - s.t / DWELLS[s.i]) : 1
    if (e.timer && Math.abs(w - e.w) > 0.001) {
      e.timer.style.transform = `scaleX(${w.toFixed(4)})`
      e.w = w
    }
  }, [])

  const onEvent = useCallback((ev) => {
    if (ev === 'fork') markRode()
    if (ev !== 'left') return
    const s = j.current
    const key = s.leaveKey
    const q = new URLSearchParams()
    const fx = searchParam('fx')
    if (fx) q.set('fx', fx)
    const a = s.anchors[key]
    const origin = a ? { x: window.innerWidth / 2 + a.x, y: window.innerHeight / 2 - a.y } : null
    warpTo(`/${key}${q.size ? `?${q}` : ''}`, origin)
  }, [])

  // a cut (skip, or flying it again) hides behind a quick fade from black
  const blink = useCallback(() => {
    if (!j.current.reduced) blinkRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, easing: 'ease-out' })
  }, [])

  const advance = useCallback(() => {
    next(j.current)
    tick()
  }, [tick])

  const skip = useCallback(() => {
    const s = j.current
    if (!riding(s.phase)) return
    toFork(s)
    markRode()
    blink()
    tick()
  }, [blink, tick])

  const again = useCallback(() => {
    const s = j.current
    if (s.phase !== 'fork') return
    restart(s)
    s.tap = true
    blink()
    tick()
  }, [blink, tick])

  const go = useCallback(
    (key) => {
      const s = j.current
      if (!leave(s, key)) return
      s.hover = key
      markRode()
      tick()
    },
    [tick],
  )

  const hover = useCallback((key) => {
    const s = j.current
    if (s.phase === 'fork') s.hover = key
  }, [])

  // space holds (take off, then go faster); → / Enter / D: next; Esc: skip. At the fork: ← me, → the work, ↓ play.
  useEffect(() => {
    const down = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
      const s = j.current
      const control = onControl(e.target)
      if (riding(s.phase)) {
        if (e.key === ' ') {
          if (control) return
          e.preventDefault()
          s.holding = true
        } else if (e.key === 'Escape') {
          e.preventDefault()
          skip()
        } else if ((e.key === 'Enter' && !control) || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault()
          if (!e.repeat) advance()
        }
        return
      }
      if (s.phase !== 'fork' || e.repeat || s.t < GRACE) return
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const key = k === 'ArrowLeft' || k === 'a' ? 'under' : k === 'ArrowRight' || k === 'd' ? 'top' : k === 'ArrowDown' || k === 's' ? 'play' : null
      if (key) {
        e.preventDefault()
        go(key)
      } else if (k === 'r') {
        e.preventDefault()
        again()
      }
    }
    const up = (e) => {
      if (e.key === ' ') j.current.holding = false
    }
    const blur = () => {
      j.current.holding = false
      press.current = null
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [advance, again, go, skip])

  // A press on open space holds like space does. Released quickly it's a click: take off, or next.
  const onPointerMove = (e) => {
    const s = j.current
    s.mouse.x = e.clientX / window.innerWidth
    s.mouse.y = e.clientY / window.innerHeight
    s.pointer = e.pointerType === 'mouse'
  }
  const onPointerLeave = () => {
    j.current.pointer = false
  }
  const onPointerDown = (e) => {
    const s = j.current
    if (e.button !== 0 || !riding(s.phase) || onControl(e.target)) return
    press.current = { at: performance.now(), id: e.pointerId }
    s.holding = true
  }
  const onPointerUp = (e) => {
    const pr = press.current
    if (!pr || pr.id !== e.pointerId) return
    press.current = null
    const s = j.current
    s.holding = false
    if (s.phase === 'ready') {
      if (s.charge < 1) s.tap = true
    } else if (performance.now() - pr.at < 240 && !window.getSelection?.().toString()) next(s)
    tick()
  }
  const onPointerCancel = () => {
    press.current = null
    j.current.holding = false
  }

  // measure where the fork's galaxies and game sit, for the scene (centre-origin px, y up)
  useLayoutEffect(() => {
    const measure = () => {
      const a = {}
      for (const [k, el] of Object.entries(discs.current)) {
        if (!el) continue
        const b = el.getBoundingClientRect()
        if (!b.width) continue
        a[k] = { x: b.left + b.width / 2 - window.innerWidth / 2, y: window.innerHeight / 2 - (b.top + b.height / 2), r: b.width / 2 }
      }
      j.current.anchors = a
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(document.documentElement)
    window.addEventListener('resize', measure)
    // the titles reflow when Archivo lands, moving the discs without resizing anything
    document.fonts?.ready.then(measure).catch(() => {})
    document.fonts?.addEventListener('loadingdone', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      document.fonts?.removeEventListener('loadingdone', measure)
    }
  }, [])

  const tier = getTier()
  const flying = riding(view.phase) && view.phase !== 'ready'
  const lit = view.fork || view.phase === 'ready' ? null : JOURNEY[Math.min(view.i, N - 1)].city

  return (
    <div
      className="journey"
      data-phase={view.phase}
      data-fork={view.fork ? 'on' : ''}
      style={lit ? cityVars(lit) : OPEN_VARS}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <h1 className="sr-only">Saubhagya Dubey</h1>
      <div className="journey__sky" aria-hidden="true">
        <Canvas
          dpr={[1, dprFor(tier)]}
          gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
          camera={{ fov: FOV, near: 0.05, far: 6000, position: [0, 0.47, -0.6], rotation: [0, 0, 0] }}
        >
          <JourneyScene j={j} dwells={DWELLS} onTick={tick} onEvent={onEvent} />
        </Canvas>
      </div>
      <div className="journey__canopy" aria-hidden="true" />

      <header className="journey__top mono">
        <span>
          deep field <b>· saubhagya dubey</b>
        </span>
        <nav>
          {riding(view.phase) ? (
            <button type="button" className="journey__link" onClick={skip}>
              skip to the end
            </button>
          ) : null}
          <a
            className="journey__link"
            href="/text"
            onClick={(e) => {
              e.preventDefault()
              navigate('/text')
            }}
          >
            read it as text
          </a>
        </nav>
      </header>

      {view.phase === 'ready' ? (
        <Ready
          fine={fine}
          chargeRef={chargeRef}
          onIgnite={() => {
            j.current.tap = true
          }}
        />
      ) : null}

      <div className="journey__cards" aria-live="polite">
        {view.last !== null ? <Card key={view.last} stop={JOURNEY[view.last]} on={view.card === view.last} timerRef={timerRef} /> : null}
      </div>

      <Fork on={view.fork} leaving={view.leaving} discRefs={discRefs} fine={fine} onGo={go} onHover={hover} onAgain={again} />

      {flying ? <Hud i={view.i} phase={view.phase} fine={fine} routeRef={routeRef} onNext={advance} /> : null}

      <div className="journey__blink" ref={blinkRef} aria-hidden="true" />
    </div>
  )
}

// Before take-off: a ring that fills while you hold.
function Ready({ fine, chargeRef, onIgnite }) {
  return (
    <div className="journey-ready">
      <p className="poster__kicker journey-ready__kicker">{READY.kicker}</p>
      <button type="button" className="journey-ignite" onClick={onIgnite} aria-label={fine ? 'hold space or click to take off' : 'tap to take off'}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="journey-ignite__track" cx="50" cy="50" r="46" />
          <circle className="journey-ignite__fill" ref={chargeRef} cx="50" cy="50" r="46" pathLength="1" />
        </svg>
        <span className="journey-ignite__chev" aria-hidden="true" />
      </button>
      <p className="journey-ready__key">{fine ? READY.key : READY.touchKey}</p>
      <p className="journey-ready__line">{fine ? READY.line : READY.touchLine}</p>
      <p className="journey-ready__time mono">{fine ? `${READY.time} · ${READY.escape}` : READY.time}</p>
    </div>
  )
}

// Sizes a card's title to the canopy: the largest size where no word overflows the card and it takes at
// most two lines, capped so a short word like "tide" doesn't swallow the screen. Runs again once Archivo has
// loaded (the fallback is narrower). Overflow is read off the text itself; the hatched shadows hang past it.
function useFitTitle(ref) {
  useLayoutEffect(() => {
    const title = ref.current?.querySelector('.journey-card__title')
    if (!title) return
    const ink = document.createRange()
    ink.selectNodeContents(title)
    const fit = () => {
      let lo = 26
      let hi = Math.max(lo, Math.min(150, window.innerHeight * 0.19, window.innerWidth * 0.16))
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2
        title.style.fontSize = `${mid}px`
        const box = title.getBoundingClientRect()
        const r = ink.getBoundingClientRect()
        const fits = r.right <= box.right + 1 && r.left >= box.left - 1 && title.offsetHeight <= mid * 0.86 * 2 + 4
        if (fits) lo = mid
        else hi = mid
      }
      title.style.fontSize = `${lo}px`
    }
    let live = true
    fit()
    const fonts = document.fonts
    if (fonts) Promise.all([fonts.load('800 100px "Archivo Variable"'), fonts.load('400 20px "Archivo Variable"')]).then(() => live && fit())
    window.addEventListener('resize', fit)
    return () => {
      live = false
      window.removeEventListener('resize', fit)
    }
  }, [ref])
}

// One stop: a kicker, the title as a poster, one line in my voice, one plain fact, and the countdown to leaving.
function Card({ stop, on, timerRef }) {
  const ref = useRef(null)
  useFitTitle(ref)
  return (
    <article className="journey-card" ref={ref} data-on={on} aria-hidden={!on}>
      <p className="poster__kicker journey-card__kicker">{stop.kicker}</p>
      <h2 className="poster__title journey-card__title" data-text={stop.title}>
        <span className="poster__ink">{stop.title}</span>
      </h2>
      <p className="journey-card__line">{stop.line}</p>
      <p className="journey-card__fact mono">{stop.fact}</p>
      <span className="journey-card__timer" aria-hidden="true">
        <i ref={on ? timerRef : undefined} />
      </span>
    </article>
  )
}

// The end of the ride: two galaxies (drawn in WebGL under the discs) and the game. Rendered from the start,
// hidden, so the discs can be measured before you get there.
function Fork({ on, leaving, discRefs, fine, onGo, onHover, onAgain }) {
  const handlers = (key) => ({
    onClick: (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      e.preventDefault()
      onGo(key)
    },
    onPointerEnter: () => onHover(key),
    onPointerLeave: () => onHover(null),
    onFocus: () => onHover(key),
    onBlur: () => onHover(null),
  })
  return (
    <section className="journey-fork" data-on={on} data-leaving={leaving ?? ''} aria-hidden={!on} inert={!on} aria-label="where to next">
      <header className="journey-fork__head">
        <p className="poster__kicker journey-fork__kicker">{FORK.kicker}</p>
        <p className="journey-fork__line">{FORK.line}</p>
      </header>
      {['under', 'top'].map((key) => (
        <a key={key} className={`journey-choice journey-choice--${key}`} href={`/${key}`} style={cityVars(key)} data-picked={leaving === key} {...handlers(key)}>
          <span className="journey-choice__disc" ref={discRefs[key]} aria-hidden="true" />
          <span className="journey-choice__city">{FORK[key].city}</span>
          <span className="journey-choice__title">{FORK[key].title}</span>
          <span className="journey-choice__blurb">{FORK[key].blurb}</span>
        </a>
      ))}
      <div className="journey-fork__play" data-picked={leaving === 'play'}>
        <span className="journey-fork__or">{FORK.play.blurb}</span>
        <a className="journey-slab" href="/play" ref={discRefs.play} {...handlers('play')}>
          <span>{FORK.play.title}</span>
        </a>
      </div>
      <footer className="journey-fork__foot mono">
        {fine ? (
          <span className="journey-keys">
            <kbd>←</kbd> me <kbd>→</kbd> the work <kbd>↓</kbd> play
          </span>
        ) : (
          <span />
        )}
        <button type="button" className="journey__link" onClick={onAgain}>
          fly it again
        </button>
      </footer>
    </section>
  )
}

// The bottom of the canopy: where you are on the route, and how to move it along.
function Hud({ i, phase, fine, routeRef, onNext }) {
  const reached = phase === 'dwell' ? i + 1 : i
  return (
    <footer className="journey-hud">
      <span className="journey-hud__count">
        <b>{i < N ? pad(i + 1) : '--'}</b> / {pad(N)}
        <em>{i < N ? JOURNEY[i].short : 'the fork'}</em>
      </span>
      <span className="journey-hud__route" aria-hidden="true">
        <span className="journey-hud__rail">
          <i ref={routeRef} />
        </span>
        {JOURNEY.map((st, k) => (
          <span key={st.id} className="journey-hud__stop" data-state={k < reached ? 'done' : k === i ? 'next' : ''} style={{ left: `${((k + 1) / (N + 1)) * 100}%` }} />
        ))}
        <span className="journey-hud__stop journey-hud__stop--fork" data-state={i >= N ? 'next' : ''} style={{ left: '100%' }} />
      </span>
      <span className="journey-hud__keys mono">
        <span className="journey-hud__hint">{fine ? 'hold space to go faster' : 'hold to go faster'}</span>
        <button type="button" className="journey-hud__next" onClick={onNext}>
          next <span aria-hidden="true">›</span>
        </button>
      </span>
    </footer>
  )
}
