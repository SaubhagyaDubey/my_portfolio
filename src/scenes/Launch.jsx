import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { EARTH_TEXTURES } from '../three/Planet.jsx'
import Helmet from '../components/Helmet.jsx'
import { cityVars } from '../data/palette.js'
import { LAUNCH } from '../data/worlds.js'
import { dprFor, getTier } from '../lib/tier.js'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import { navigate } from '../lib/router.js'
import { warpTo } from '../lib/warp.js'
import LaunchScene from '../three/LaunchScene.jsx'
import './launch.css'

// The start, set like a chapter card: the undercity on one side, topside on the other, my name between.
// Hover a side and its city bleeds across the seam; click and the stars pull in, then paint splashes.
export default function Launch() {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const stacked = useMediaQuery('(max-width: 720px)')
  const [hover, setHover] = useState(null)
  const [warp, setWarp] = useState(null)
  const state = useRef({ hover: null, warp: null, warpT: 0, mouse: { x: 0.5, y: 0.5 }, discs: {}, reduced, stacked })
  const underRef = useRef()
  const topRef = useRef()

  useEffect(() => {
    state.current.hover = hover
    state.current.reduced = reduced
    state.current.stacked = stacked
    if (hover === 'under') useLoader.preload(THREE.TextureLoader, EARTH_TEXTURES)
  }, [hover, reduced, stacked])

  // measure where the galaxy discs sit so the WebGL galaxies render under them
  useLayoutEffect(() => {
    const measure = () => {
      const d = {}
      for (const [k, ref] of [
        ['under', underRef],
        ['top', topRef],
      ]) {
        const el = ref.current
        if (!el) continue
        const b = el.getBoundingClientRect()
        d[k] = { x: b.left + b.width / 2 - window.innerWidth / 2, y: window.innerHeight / 2 - (b.top + b.height / 2), r: b.width / 2 }
      }
      state.current.discs = d
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(document.documentElement)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  useEffect(() => {
    const move = (e) => {
      state.current.mouse.x = e.clientX / window.innerWidth
      state.current.mouse.y = e.clientY / window.innerHeight
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])

  const go = (key, e) => {
    if (warp) return
    const origin = e && e.clientX ? { x: e.clientX, y: e.clientY } : null
    setWarp(key)
    state.current.warp = key
    const dur = reduced ? 0 : 1000
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur)
      state.current.warpT = t
      if (t < 1) requestAnimationFrame(tick)
      else warpTo(`/${key}`, origin)
    }
    if (dur) requestAnimationFrame(tick)
    else warpTo(`/${key}`, origin)
  }

  const look = hover === 'under' && !stacked ? 'look-left' : hover === 'top' && !stacked ? 'look-right' : stacked && hover === 'top' ? 'look-up' : stacked && hover === 'under' ? 'look-down' : 'front'
  const prompt = hover === 'under' ? LAUNCH.under : hover === 'top' ? LAUNCH.top : LAUNCH.idle
  const tier = getTier()

  return (
    <div className="launch" data-warp={warp ?? ''} data-hover={hover ?? ''} style={hover ? cityVars(hover) : undefined}>
      <div className="launch__sky" aria-hidden="true">
        <Canvas
          orthographic
          dpr={[1, dprFor(tier)]}
          gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
          camera={{ position: [0, 0, 100], zoom: 1 }}
        >
          <LaunchScene state={state} />
        </Canvas>
      </div>

      <div className="launch__corner mono">
        <span>
          deep field <b>· two cities, one person</b>
        </span>
        <span className="launch__links">
          <a
            href="/play"
            className="launch__play"
            onClick={(e) => {
              e.preventDefault()
              navigate('/play')
            }}
          >
            play impact
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

      <div className="launch__stage">
        <button
          className="galaxy galaxy--under"
          style={cityVars('under')}
          onPointerEnter={() => setHover('under')}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover('under')}
          onBlur={() => setHover(null)}
          onClick={(e) => go('under', e)}
          aria-label={`${LAUNCH.underCity}: ${LAUNCH.underTitle}. ${LAUNCH.under}`}
        >
          <span className="galaxy__disc" ref={underRef} aria-hidden="true" />
          <span className="galaxy__city mono">{LAUNCH.underCity}</span>
          <span className="galaxy__title">{LAUNCH.underTitle}</span>
        </button>

        <div className="launch__mid">
          <Helmet look={look} tint={hover ?? ''} />
          <p className="launch__act mono">{LAUNCH.act}</p>
          <h1 className="launch__name">
            <span>{LAUNCH.name}</span>
            <small className="mono">{LAUNCH.sub}</small>
          </h1>
          <p className="launch__hello">{LAUNCH.hello}</p>
          <div className="launch__prompt mono" aria-live="polite">
            {prompt}
          </div>
        </div>

        <button
          className="galaxy galaxy--top"
          style={cityVars('top')}
          onPointerEnter={() => setHover('top')}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover('top')}
          onBlur={() => setHover(null)}
          onClick={(e) => go('top', e)}
          aria-label={`${LAUNCH.topCity}: ${LAUNCH.topTitle}. ${LAUNCH.top}`}
        >
          <span className="galaxy__disc" ref={topRef} aria-hidden="true" />
          <span className="galaxy__city mono">{LAUNCH.topCity}</span>
          <span className="galaxy__title">{LAUNCH.topTitle}</span>
        </button>
      </div>

      <div className="launch__foot mono">
        <span>{LAUNCH.hint}</span>
        <span>new delhi · 28.6° n</span>
      </div>
    </div>
  )
}
