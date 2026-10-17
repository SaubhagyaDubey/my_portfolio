import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import Helmet from '../components/Helmet.jsx'
import { cityVars } from '../data/palette.js'
import { LAUNCH, previewLines } from '../data/worlds.js'
import { useGaze } from '../hooks/useGaze.js'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import { INTRO, INTRO_DOM, markIntroSeen, shouldPlayIntro } from '../lib/intro.js'
import { leanFrom, nextArmed } from '../lib/lean.js'
import { navigate, searchParam } from '../lib/router.js'
import { dprFor, getTier } from '../lib/tier.js'
import { warpTo } from '../lib/warp.js'
import { useStore } from '../state/store.js'
import { EARTH_TEXTURES } from '../three/Planet.jsx'
import LaunchScene from '../three/LaunchScene.jsx'
import './launch.css'

const SIDE = {
  under: { city: LAUNCH.underCity, title: LAUNCH.underTitle, blurb: LAUNCH.under, lines: previewLines('under') },
  top: { city: LAUNCH.topCity, title: LAUNCH.topTitle, blurb: LAUNCH.top, lines: previewLines('top') },
}

function freshState(reduced, stacked, introOn) {
  return {
    mouse: { x: 0.5, y: 0.5 },
    pointer: false, // a mouse is over the card
    lastPointer: 'mouse',
    lean: 0, // where the pointer leans, -1 undercity .. +1 topside
    leanS: 0, // the same, eased (Director)
    overPlay: false,
    armed: null, // 'under' | 'top' | 'play' | null
    warp: null,
    warpT: 0,
    discs: {}, // measured anchors in centre-origin px, y up: under, top, play, ship, face
    reduced,
    stacked,
    intro: { on: introOn, t: 0, rate: 1, anims: [], finish: null },
    seam: 0.5,
    glow: { under: 0, top: 0 },
    seamPulse: 0,
    fx: { spark: 0, tear: 1.05, flood: 1, birth: 1, stars: 1, ship: 1 },
  }
}

// The start, set like a title card: the undercity on one side, topside on the other, my name and the
// ship between. Lean toward a side and its city pushes across the seam and its route lights up; click
// anywhere on it (or one of its stops) and the ship dives into that galaxy. First visit opens cold.
export default function Launch() {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const stacked = useMediaQuery('(max-width: 720px)')
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)')
  const [armed, setArmed] = useState(null)
  const [warp, setWarp] = useState(null)
  const [introOn, setIntroOn] = useState(() => shouldPlayIntro(reduced))
  const visited = useStore((s) => s.visited)
  const state = useRef(null)
  if (state.current === null) state.current = freshState(reduced, stacked, introOn)

  const rootRef = useRef()
  const underRef = useRef()
  const topRef = useRef()
  const playRef = useRef()
  const shipRef = useRef()
  const faceRef = useRef()
  const measureRef = useRef(() => {})

  const face = useGaze(state, { armed, warp, introOn, stacked, reduced })

  useEffect(() => {
    state.current.reduced = reduced
    state.current.stacked = stacked
  }, [reduced, stacked])

  useEffect(() => {
    if (import.meta.env.DEV) window.__launch = state
  }, [])

  const arm = useCallback((key) => {
    const s = state.current
    if (s.armed === key) return
    s.armed = key
    setArmed(key)
    if (key === 'under') useLoader.preload(THREE.TextureLoader, EARTH_TEXTURES)
  }, [])

  // measure the anchors the WebGL scene draws under: galaxy discs, the ship's spot, the play button, the face
  useLayoutEffect(() => {
    const measure = () => {
      const d = {}
      for (const [k, ref] of [
        ['under', underRef],
        ['top', topRef],
        ['play', playRef],
        ['ship', shipRef],
        ['face', faceRef],
      ]) {
        const el = ref.current
        if (!el) continue
        const b = el.getBoundingClientRect()
        d[k] = { x: b.left + b.width / 2 - window.innerWidth / 2, y: window.innerHeight / 2 - (b.top + b.height / 2), r: b.width / 2, h: b.height }
      }
      state.current.discs = d
    }
    measureRef.current = measure
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(document.documentElement)
    if (rootRef.current) ro.observe(rootRef.current.querySelector('.launch__stage'))
    window.addEventListener('resize', measure)
    // the name and city titles reflow when Archivo lands, moving the anchors without resizing the stage
    document.fonts?.ready.then(measure).catch(() => {})
    document.fonts?.addEventListener('loadingdone', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      document.fonts?.removeEventListener('loadingdone', measure)
    }
  }, [])

  // ---- the cold open: paused WAAPI animations before first paint, scrubbed by the Director's clock
  useLayoutEffect(() => {
    const s = state.current
    if (!introOn) {
      s.intro.on = false
      return undefined
    }
    const anims = []
    for (const { sel, frames } of INTRO_DOM) {
      for (const el of rootRef.current.querySelectorAll(sel)) {
        const a = el.animate(frames, { duration: INTRO.total * 1000, fill: 'both' })
        a.pause()
        a.currentTime = 0
        anims.push(a)
      }
    }
    const finish = () => {
      if (!s.intro.on) return
      s.intro.on = false
      for (const a of anims) a.cancel()
      markIntroSeen()
      setIntroOn(false)
      requestAnimationFrame(() => measureRef.current())
    }
    s.intro = { on: true, t: 0, rate: 1, anims, finish, hold: false }
    // if the canvas never draws, don't leave the card blank; if it draws slowly, hurry it along
    const start = performance.now()
    const watch = window.setInterval(() => {
      if (s.intro.hold) return
      const waited = performance.now() - start
      if (s.intro.t === 0 && waited > 2500) finish()
      else if (waited > 4000) s.intro.rate = Math.max(s.intro.rate, 6)
    }, 250)
    return () => {
      window.clearInterval(watch)
      for (const a of anims) a.cancel()
      s.intro.on = false
    }
  }, [introOn])

  // any input fast-forwards the rest of the intro instead of cutting it
  const skipIntro = useCallback(() => {
    const s = state.current
    if (s.intro.on) s.intro.rate = 6
  }, [])

  const go = useCallback(
    (key, e, stopId) => {
      const s = state.current
      if (s.warp || s.intro.on) return
      s.warp = key
      setWarp(key)
      arm(key)
      if (key !== 'play') s.lean = key === 'under' ? -1 : 1
      const d = s.discs[key]
      const origin = d ? { x: window.innerWidth / 2 + d.x, y: window.innerHeight / 2 - d.y } : e?.clientX ? { x: e.clientX, y: e.clientY } : null
      const q = new URLSearchParams()
      if (stopId) q.set('stop', stopId)
      const fx = searchParam('fx')
      if (fx) q.set('fx', fx)
      const path = `/${key}${q.size ? `?${q}` : ''}`
      const dur = s.reduced ? 0 : 1000
      if (!dur) {
        warpTo(path, origin)
        return
      }
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min(1, (now - start) / dur)
        s.warpT = t
        if (t < 1) requestAnimationFrame(tick)
        else warpTo(path, origin)
      }
      requestAnimationFrame(tick)
    },
    [arm],
  )

  // ← / A = me, → / D = the work, ↓ / S = the game
  useEffect(() => {
    const down = (e) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (state.current.intro.on) {
        skipIntro()
        return
      }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const key = k === 'ArrowLeft' || k === 'a' ? 'under' : k === 'ArrowRight' || k === 'd' ? 'top' : k === 'ArrowDown' || k === 's' ? 'play' : null
      if (!key) return
      e.preventDefault()
      go(key, null)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('wheel', skipIntro, { passive: true })
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('wheel', skipIntro)
    }
  }, [go, skipIntro])

  // ---- pointer: the whole card leans toward the side you're on
  const onPointerMove = (e) => {
    const s = state.current
    s.mouse.x = e.clientX / window.innerWidth
    s.mouse.y = e.clientY / window.innerHeight
    if (e.pointerType === 'touch') return
    s.pointer = true
    if (s.intro.on || s.warp) return
    s.lean = leanFrom(e.clientX, e.clientY, window.innerWidth, window.innerHeight, s.stacked)
    if (!s.overPlay) arm(nextArmed(s.armed === 'play' ? null : s.armed, s.lean))
  }
  const onPointerLeave = () => {
    const s = state.current
    s.pointer = false
    if (s.warp) return
    s.lean = 0
    if (!s.overPlay) arm(null)
  }
  const onPointerDown = (e) => {
    state.current.lastPointer = e.pointerType
    skipIntro()
  }
  // a click on the armed side's open space goes in; links and buttons handle themselves
  const onClick = (e) => {
    const s = state.current
    if (s.intro.on || s.warp || s.lastPointer === 'touch') return
    if (e.target instanceof Element && e.target.closest('a, button')) return
    if (window.getSelection?.().toString()) return
    if (s.armed === 'under' || s.armed === 'top') go(s.armed, e)
  }

  // keyboard focus arms a side the way the pointer does
  const focusArm = (key) => {
    const s = state.current
    if (s.warp) return
    s.lean = key === 'under' ? -1 : key === 'top' ? 1 : 0
    arm(key)
  }
  const blurArm = (e) => {
    const s = state.current
    if (s.warp || (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) return
    if (!s.pointer) s.lean = 0
    arm(null)
  }

  const city = armed === 'under' || armed === 'top' ? armed : null
  const tier = getTier()

  return (
    <div
      className="launch"
      ref={rootRef}
      data-armed={armed ?? ''}
      data-warp={warp ?? ''}
      data-intro={introOn ? 'on' : ''}
      style={city ? cityVars(city) : undefined}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <div className="launch__sky" aria-hidden="true">
        <Canvas
          orthographic
          dpr={[1, tier === 2 ? 2 : dprFor(tier)]}
          gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
          camera={{ position: [0, 0, 400], zoom: 1, near: 0.1, far: 1000 }}
        >
          <LaunchScene state={state} />
        </Canvas>
      </div>

      <div className="launch__corner mono">
        <span>
          deep field <b>· two cities, one person</b>
        </span>
        <a
          href="/text"
          onClick={(e) => {
            e.preventDefault()
            navigate('/text')
          }}
        >
          read it as text
        </a>
      </div>

      <div className="launch__stage">
        {['under', 'top'].map((key) => (
          <Side
            key={key}
            id={key}
            discRef={key === 'under' ? underRef : topRef}
            visited={visited[key] ?? []}
            onGo={go}
            onFocus={() => focusArm(key)}
            onBlur={blurArm}
          />
        ))}

        <div className="launch__mid">
          <Helmet look={face} tint={city ?? ''} ref={faceRef} />
          <h1 className="launch__name">
            <span>{LAUNCH.name}</span>
          </h1>
          <p className="launch__hello">{LAUNCH.line}</p>
        </div>

        <div className="launch__third">
          <span className="launch__ship" ref={shipRef} aria-hidden="true" />
          <span className="launch__or mono">{LAUNCH.playOr}</span>
          <a
            href="/play"
            className="launch__play"
            ref={playRef}
            onPointerEnter={() => {
              state.current.overPlay = true
              arm('play')
            }}
            onPointerLeave={() => {
              const s = state.current
              s.overPlay = false
              if (!s.warp) arm(nextArmed(null, s.lean))
            }}
            onFocus={() => focusArm('play')}
            onBlur={blurArm}
            onClick={(e) => {
              e.preventDefault()
              go('play', e)
            }}
            aria-label={`${LAUNCH.playTitle}. ${LAUNCH.play}`}
          >
            <span>{LAUNCH.playTitle}</span>
          </a>
        </div>
      </div>

      <div className="launch__foot mono">
        {fine ? (
          <span className="launch__keys">
            <kbd>←</kbd> me <kbd>→</kbd> the work <kbd>↓</kbd> play <em>· {LAUNCH.keys}</em>
          </span>
        ) : (
          <span>{LAUNCH.hint}</span>
        )}
        <span>new delhi · 28.6° n</span>
      </div>
    </div>
  )
}

// One city: its galaxy (drawn in WebGL under the measured disc), the door, and its route as links.
function Side({ id, discRef, visited, onGo, onFocus, onBlur }) {
  const side = SIDE[id]
  return (
    <section className={`side side--${id}`} style={cityVars(id)} onFocus={onFocus} onBlur={onBlur}>
      <span className="side__disc" ref={discRef} aria-hidden="true" />
      <button className="side__go" onClick={(e) => onGo(id, e)} aria-label={`${side.city}: ${side.title}. ${side.blurb}`}>
        <span className="side__city">{side.city}</span>
        <span className="side__title">{side.title}</span>
        <span className="side__blurb">{side.blurb}</span>
      </button>
      <ol className="side__peek" aria-label={`${side.city}, stop by stop`}>
        {side.lines.map((l) => (
          <li key={l.id}>
            <a
              href={`/${id}?stop=${l.id}`}
              data-visited={visited.includes(l.id)}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                e.preventDefault()
                e.stopPropagation()
                onGo(id, e, l.id)
              }}
            >
              <i className="side__mark" aria-hidden="true" />
              {l.year ? <span className="side__year">{l.year}</span> : null}
              <b>{l.name}</b>
              <span className="side__meta">{l.meta}</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}
