import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BASE, CITIES } from '../data/palette.js'
import { INTRO, beat, easeInOut, easeOutCubic, easeOutExpo } from '../lib/intro.js'
import { SEAM_WARP, ease, seamFor } from '../lib/lean.js'
import { mulberry32 } from '../lib/seed.js'
import { fxEnabled, getTier } from '../lib/tier.js'
import Effects from './Effects.jsx'
import { GALAXY_COUNT, buildGalaxy } from './galaxy.js'
import LaunchShip from './LaunchShip.jsx'
import {
  flatVert,
  galaxyFrag,
  galaxyHaloFrag,
  galaxyVert,
  launchLineFrag,
  launchLineVert,
  launchSkyFrag,
  launchStarFrag,
  launchStarVert,
} from './shaders.js'
import { color, useShaderMaterial } from './useShaderMaterial.js'

const N_STARS = 560

// The orthographic launch scene works in CSS pixels: world x = px - W/2, world y = H/2 - py.
// `state` is the Launch state ref (see freshState in src/scenes/Launch.jsx).

// One clock for the whole card. Runs first every frame: advances the cold open (and scrubs its DOM
// animations), eases the lean, and works out the seam, each galaxy's glow and the intro beats that
// everything else reads.
function Director({ state }) {
  useFrame((_, delta) => {
    const s = state.current
    const dt = Math.min(delta, 1 / 30) // a slow first frame mustn't swallow the intro's beats
    const intro = s.intro
    if (intro.on) {
      intro.t += dt * intro.rate
      const ms = Math.min(intro.t, INTRO.total) * 1000
      for (const a of intro.anims) a.currentTime = ms
      const before = intro.t - dt * intro.rate
      if (before < INTRO.pulse && intro.t >= INTRO.pulse) s.seamPulse = 1
      if (intro.t >= INTRO.total) intro.finish?.()
    }
    const t = intro.on ? intro.t : INTRO.total
    const fx = s.fx
    fx.spark = easeOutExpo(beat(t, INTRO.spark)) * (1 - beat(t, INTRO.sparkFade))
    fx.tear = easeInOut(beat(t, INTRO.tear)) * 1.05
    fx.flood = easeOutCubic(beat(t, INTRO.flood))
    fx.birth = beat(t, INTRO.birth)
    fx.stars = beat(t, INTRO.stars)
    fx.ship = easeOutCubic(beat(t, INTRO.ship))

    // the lean: the pointer's, or a whole side when it's armed by keyboard or committed
    let target = intro.on ? 0 : s.lean
    if (s.warp === 'under' || s.warp === 'top') target = s.warp === 'under' ? -1 : 1
    else if (s.reduced) target = s.armed === 'under' ? -1 : s.armed === 'top' ? 1 : 0
    s.leanS = s.reduced ? target : ease(s.leanS, target, 7, dt)

    if (s.warp === 'under' || s.warp === 'top') s.seam = s.reduced ? SEAM_WARP[s.warp] : ease(s.seam, SEAM_WARP[s.warp], 3.5, dt)
    else s.seam = seamFor(s.leanS)

    s.glow.under = s.warp === 'under' ? 1 : Math.max(0, -s.leanS)
    s.glow.top = s.warp === 'top' ? 1 : Math.max(0, s.leanS)
    s.seamPulse *= Math.exp(-6 * dt)
  })
  return null
}

function Galaxy({ id, state }) {
  const { gl } = useThree()
  const city = CITIES[id]
  const geometry = useMemo(() => {
    const { pos, size, col, phase, radius } = buildGalaxy(id, GALAXY_COUNT[getTier()])
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    g.setAttribute('aR', new THREE.BufferAttribute(radius, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    return g
  }, [id])
  useEffect(() => () => geometry.dispose(), [geometry])
  const dir = id === 'under' ? 1 : -1
  const uniforms = useMemo(
    () => ({
      uSpin: { value: id === 'under' ? 0.4 : 1.9 },
      uSpinDir: { value: dir },
      uTime: { value: 0 },
      uGlow: { value: 0 },
      uScale: { value: 1 },
      uBirth: { value: 1 },
      uPixelRatio: { value: gl.getPixelRatio() },
    }),
    [gl, id, dir],
  )
  const material = useShaderMaterial(galaxyVert, galaxyFrag, uniforms, {
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const haloU = useMemo(() => ({ uColor: { value: color(city.accent) }, uGlow: { value: 0 }, uBirth: { value: 1 } }), [city])
  const halo = useShaderMaterial(flatVert, galaxyHaloFrag, haloU, {
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const group = useRef()
  useFrame(({ clock }, delta) => {
    const s = state.current
    const g = s.discs[id]
    if (!g || !group.current) return
    const dt = Math.min(delta, 0.05)
    const glow = s.glow[id]
    uniforms.uGlow.value = glow
    haloU.uGlow.value = glow
    uniforms.uBirth.value = s.fx.birth
    haloU.uBirth.value = s.fx.birth
    const warping = s.warp === id
    const targetScale = warping ? 1 + s.warpT * s.warpT * 9 : 1
    uniforms.uScale.value = s.reduced ? targetScale : ease(uniforms.uScale.value, targetScale, 6, dt)
    if (!s.reduced) uniforms.uSpin.value += dt * (0.04 + glow * 0.1 + (warping ? s.warpT * 0.8 : 0)) * dir
    uniforms.uTime.value = clock.getElapsedTime()
    const px = (s.mouse.x - 0.5) * -10
    const py = (s.mouse.y - 0.5) * 8
    group.current.position.set(g.x + px, g.y + py, 0)
    group.current.scale.setScalar(g.r)
  })
  return (
    <group ref={group}>
      <mesh material={halo} renderOrder={1} scale={3}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <points geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />
    </group>
  )
}

function Stars({ state }) {
  const { gl, size } = useThree()
  const data = useMemo(() => {
    const rand = mulberry32(17)
    return Array.from({ length: N_STARS }, () => ({
      x: rand(),
      y: rand(),
      z: rand(),
      s: 0,
      tw: rand() * Math.PI * 2,
    })).map((st) => ({ ...st, s: 1.2 + st.z * 2.6 + (rand() < 0.05 ? 2.5 : 0) }))
  }, [])
  const pointGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_STARS * 3), 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N_STARS), 1))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(N_STARS), 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    return g
  }, [])
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_STARS * 6), 3))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(N_STARS * 2), 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    return g
  }, [])
  const pointU = useMemo(() => ({ uPixelRatio: { value: gl.getPixelRatio() } }), [gl])
  const pointMat = useShaderMaterial(launchStarVert, launchStarFrag, pointU, {
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const lineU = useMemo(() => ({ uPull: { value: 0 } }), [])
  const lineMat = useShaderMaterial(launchLineVert, launchLineFrag, lineU, {
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const pull = useRef(0)

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05)
    const s = state.current
    const W = size.width
    const H = size.height
    const t = clock.getElapsedTime()
    // stars drift toward the side you lean into, and stream into it when you commit
    const key = s.warp ?? (s.armed === 'under' || s.armed === 'top' || s.armed === 'play' ? s.armed : null)
    const target = key ? s.discs[key] : null
    const lean = s.armed === 'play' ? 0.35 : Math.abs(s.leanS) * 0.35
    const wantPull = s.reduced ? 0 : s.warp ? 1 : lean
    pull.current = ease(pull.current, wantPull, s.warp ? 6 : 3, dt)
    const p = pull.current
    lineU.uPull.value = p
    const vis = s.fx.stars
    const pp = pointGeo.attributes.position.array
    const ps = pointGeo.attributes.aSize.array
    const pa = pointGeo.attributes.aAlpha.array
    const lp = lineGeo.attributes.position.array
    const la = lineGeo.attributes.aAlpha.array
    for (let i = 0; i < N_STARS; i++) {
      const st = data[i]
      const px = st.x * W + (s.mouse.x - 0.5) * -34 * st.z
      const py = st.y * H + (s.mouse.y - 0.5) * -24 * st.z
      let tx = px
      let ty = py
      if (target && p > 0.01) {
        // target is centre-origin, y up; star maths is in screen px, y down
        const gx = target.x + W / 2
        const gy = H / 2 - target.y
        const dx = gx - px
        const dy = gy - py
        const d = Math.hypot(dx, dy) || 1
        const speed = p * (120 + st.z * 260) * (s.warp ? 4 : 1)
        st.x += ((dx / d) * speed * dt) / W
        st.y += ((dy / d) * speed * dt) / H
        const len = Math.min(90, p * (30 + st.z * 60) * (s.warp ? 2.5 : 1))
        tx = px - (dx / d) * len
        ty = py - (dy / d) * len
        if (d < 14) {
          st.x = Math.random()
          st.y = Math.random()
        }
      } else if (!s.reduced) {
        st.x += 0.0012 * dt * st.z
        if (st.x > 1) st.x = 0
      }
      const tw = s.reduced ? 1 : 0.7 + 0.3 * Math.sin(t * (0.8 + st.z) + st.tw)
      pp[i * 3] = px - W / 2
      pp[i * 3 + 1] = H / 2 - py
      pp[i * 3 + 2] = 0
      ps[i] = st.s
      pa[i] = (0.35 + st.z * 0.6) * tw * vis
      lp[i * 6] = px - W / 2
      lp[i * 6 + 1] = H / 2 - py
      lp[i * 6 + 2] = 0
      lp[i * 6 + 3] = tx - W / 2
      lp[i * 6 + 4] = H / 2 - ty
      lp[i * 6 + 5] = 0
      la[i * 2] = (0.3 + st.z * 0.6) * vis
      la[i * 2 + 1] = 0
    }
    pointGeo.attributes.position.needsUpdate = true
    pointGeo.attributes.aSize.needsUpdate = true
    pointGeo.attributes.aAlpha.needsUpdate = true
    lineGeo.attributes.position.needsUpdate = true
    lineGeo.attributes.aAlpha.needsUpdate = true
  })

  return (
    <>
      <points geometry={pointGeo} material={pointMat} frustumCulled={false} />
      <lineSegments geometry={lineGeo} material={lineMat} frustumCulled={false} />
    </>
  )
}

function Sky({ state }) {
  const { size } = useThree()
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeam: { value: 0.5 },
      uVertical: { value: 0 },
      uAspect: { value: new THREE.Vector2(1, 1) },
      uUnder0: { value: color(CITIES.under.sky[0]) },
      uUnder1: { value: color(CITIES.under.sky[1]) },
      uUnderSmog: { value: color(CITIES.under.smog) },
      uTop0: { value: color(CITIES.top.sky[0]) },
      uTop1: { value: color(CITIES.top.sky[1]) },
      uTopSmog: { value: color(CITIES.top.smog) },
      uUnderAcc: { value: color(CITIES.under.accent) },
      uUnderAcc2: { value: color(CITIES.under.accent2) },
      uTopAcc: { value: color(CITIES.top.accent) },
      uTopAcc2: { value: color(CITIES.top.accent2) },
      uCore: { value: color(BASE.core) },
      uInk: { value: color(BASE.ink) },
      uTear: { value: 1.05 },
      uFlood: { value: 1 },
      uSpark: { value: 0 },
      uGlowUnder: { value: 0 },
      uGlowTop: { value: 0 },
      uPulse: { value: 0 },
    }),
    [],
  )
  const material = useShaderMaterial(flatVert, launchSkyFrag, uniforms, { depthWrite: false })
  useFrame(({ clock }) => {
    const s = state.current
    uniforms.uTime.value = s.reduced ? 0 : clock.getElapsedTime()
    uniforms.uAspect.value.set(size.width / Math.max(size.height, 1), 1)
    uniforms.uVertical.value = s.stacked ? 1 : 0
    uniforms.uSeam.value = s.seam
    uniforms.uTear.value = s.fx.tear
    uniforms.uFlood.value = s.fx.flood
    uniforms.uSpark.value = s.fx.spark
    // each city's nebula rolls in as you lean toward it
    uniforms.uGlowUnder.value = s.glow.under
    uniforms.uGlowTop.value = s.glow.top
    uniforms.uPulse.value = s.seamPulse
  })
  return (
    <mesh material={material} renderOrder={-10} frustumCulled={false}>
      <planeGeometry args={[size.width, size.height]} />
    </mesh>
  )
}

function Camera() {
  const { camera, size } = useThree()
  useEffect(() => {
    camera.left = -size.width / 2
    camera.right = size.width / 2
    camera.top = size.height / 2
    camera.bottom = -size.height / 2
    camera.near = 0.1
    camera.far = 1000
    camera.position.set(0, 0, 400)
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

export default function LaunchScene({ state }) {
  return (
    <>
      <color attach="background" args={[BASE.ink]} />
      <Camera />
      <Director state={state} />
      <Sky state={state} />
      <Stars state={state} />
      <Galaxy id="under" state={state} />
      <Galaxy id="top" state={state} />
      <LaunchShip state={state} />
      {fxEnabled() ? <Effects launch={state} /> : null}
    </>
  )
}
