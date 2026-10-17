import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BASE, CITIES } from '../data/palette.js'
import { mulberry32 } from '../lib/seed.js'
import { fxEnabled } from '../lib/tier.js'
import Effects from './Effects.jsx'
import {
  coronaFrag,
  flatVert,
  galaxyFrag,
  galaxyVert,
  launchLineFrag,
  launchLineVert,
  launchSkyFrag,
  launchStarFrag,
  launchStarVert,
} from './shaders.js'
import { color, useShaderMaterial } from './useShaderMaterial.js'

const N_STARS = 560
const N_GAL = 4200

// The orthographic launch scene works in CSS pixels: world x = px - W/2, world y = H/2 - py.

function Galaxy({ id, state }) {
  const { gl } = useThree()
  const hue = CITIES[id].accent
  const geometry = useMemo(() => {
    const rand = mulberry32(id === 'under' ? 3 : 5)
    const pos = new Float32Array(N_GAL * 3)
    const size = new Float32Array(N_GAL)
    const col = new Float32Array(N_GAL * 3)
    const phase = new Float32Array(N_GAL)
    const base = new THREE.Color(hue)
    const core = new THREE.Color(BASE.core)
    const second = new THREE.Color(CITIES[id].accent2)
    const tmp = new THREE.Color()
    for (let i = 0; i < N_GAL; i++) {
      const bulge = rand() < 0.22
      let x
      let y
      let t
      if (bulge) {
        const rr = Math.pow(rand(), 1.6) * 0.22
        const a = rand() * Math.PI * 2
        x = Math.cos(a) * rr
        y = Math.sin(a) * rr * 0.8
        t = 0
      } else {
        t = Math.pow(rand(), 0.8)
        const arm = i % 2
        const spread = (rand() - 0.5) * (0.05 + t * 0.16)
        const ang = t * 4.2 + arm * Math.PI + spread * 2.4
        const rad = 0.05 + t * 0.95 + (rand() - 0.5) * 0.05
        x = Math.cos(ang) * rad
        y = Math.sin(ang) * rad
      }
      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = 0
      const bright = bulge ? 1.35 : 0.7 + rand() * 0.7 + (1 - t) * 0.35
      size[i] = (bulge ? 1.4 : 0.9) + rand() * 1.5
      tmp.copy(base).lerp(core, bulge ? 0.8 : Math.max(0, 0.4 - t * 0.6) + rand() * 0.12)
      if (!bulge && rand() < 0.14) tmp.lerp(second, 0.75) // flecks of the city's second light
      col[i * 3] = tmp.r * bright
      col[i * 3 + 1] = tmp.g * bright
      col[i * 3 + 2] = tmp.b * bright
      phase[i] = rand()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    return g
  }, [id, hue])
  const uniforms = useMemo(
    () => ({
      uSpin: { value: 0 },
      uTime: { value: 0 },
      uGlow: { value: 0 },
      uScale: { value: 1 },
      uPixelRatio: { value: gl.getPixelRatio() },
    }),
    [gl],
  )
  const material = useShaderMaterial(galaxyVert, galaxyFrag, uniforms, {
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const haloU = useMemo(() => ({ uTime: { value: 0 }, uColor: { value: color(hue) }, uSeed: { value: id === 'under' ? 1 : 2 } }), [hue, id])
  const halo = useShaderMaterial(flatVert, coronaFrag, haloU, {
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const group = useRef()
  const haloRef = useRef()
  useFrame(({ clock }, dt) => {
    const s = state.current
    const g = s.discs[id]
    if (!g || !group.current) return
    const hovered = s.hover === id
    const warping = s.warp === id
    uniforms.uGlow.value += ((hovered || warping ? 1 : 0) - uniforms.uGlow.value) * Math.min(1, dt * 5)
    const targetScale = warping ? 1 + s.warpT * s.warpT * 9 : 1
    uniforms.uScale.value += (targetScale - uniforms.uScale.value) * Math.min(1, dt * 6)
    if (!s.reduced) uniforms.uSpin.value += dt * (0.05 + uniforms.uGlow.value * 0.09) * (id === 'under' ? 1 : -1)
    uniforms.uTime.value = clock.getElapsedTime()
    haloU.uTime.value = clock.getElapsedTime()
    const px = (s.mouse.x - 0.5) * -10
    const py = (s.mouse.y - 0.5) * 8
    group.current.position.set(g.x + px, g.y + py, 0)
    group.current.scale.setScalar(g.r * 1.05)
    if (haloRef.current) {
      const hs = (0.62 + uniforms.uGlow.value * 0.18) * uniforms.uScale.value
      haloRef.current.scale.setScalar(hs)
    }
  })
  return (
    <group ref={group}>
      <mesh ref={haloRef} material={halo} renderOrder={1}>
        <planeGeometry args={[5, 5]} />
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
    const target = s.warp ? s.discs[s.warp] : s.hover ? s.discs[s.hover] : null
    const wantPull = s.reduced ? 0 : s.warp ? 1 : s.hover ? 0.35 : 0
    pull.current += (wantPull - pull.current) * Math.min(1, dt * (s.warp ? 6 : 3))
    const p = pull.current
    lineU.uPull.value = p
    const pp = pointGeo.attributes.position.array
    const ps = pointGeo.attributes.aSize.array
    const pa = pointGeo.attributes.aAlpha.array
    const lp = lineGeo.attributes.position.array
    const la = lineGeo.attributes.aAlpha.array
    for (let i = 0; i < N_STARS; i++) {
      const st = data[i]
      let px = st.x * W + (s.mouse.x - 0.5) * -34 * st.z
      let py = st.y * H + (s.mouse.y - 0.5) * -24 * st.z
      let tx = px
      let ty = py
      if (target && p > 0.01) {
        const dx = target.x - px
        const dy = target.y - py
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
      // pixel space → world: x right, y up
      pp[i * 3] = px - W / 2
      pp[i * 3 + 1] = H / 2 - py
      pp[i * 3 + 2] = 0
      ps[i] = st.s
      pa[i] = (0.35 + st.z * 0.6) * tw
      lp[i * 6] = px - W / 2
      lp[i * 6 + 1] = H / 2 - py
      lp[i * 6 + 2] = 0
      lp[i * 6 + 3] = tx - W / 2
      lp[i * 6 + 4] = H / 2 - ty
      lp[i * 6 + 5] = 0
      la[i * 2] = 0.3 + st.z * 0.6
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
      uBrass: { value: color(BASE.brass) },
    }),
    [],
  )
  const material = useShaderMaterial(flatVert, launchSkyFrag, uniforms, { depthWrite: false })
  useFrame(({ clock }, delta) => {
    const s = state.current
    const dt = Math.min(delta, 0.05)
    uniforms.uTime.value = s.reduced ? 0 : clock.getElapsedTime()
    uniforms.uAspect.value.set(size.width / Math.max(size.height, 1), 1)
    uniforms.uVertical.value = s.stacked ? 1 : 0
    const key = s.warp ?? s.hover
    const want = key === 'under' ? (s.warp ? 1.3 : 0.74) : key === 'top' ? (s.warp ? -0.3 : 0.26) : 0.5
    uniforms.uSeam.value += (want - uniforms.uSeam.value) * Math.min(1, dt * (s.reduced ? 60 : 3.5))
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
    camera.position.set(0, 0, 100)
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

// `state` is a ref: { hover, warp, warpT, mouse:{x,y}, discs:{under:{x,y,r}, top:{x,y,r}}, reduced, stacked }
export default function LaunchScene({ state }) {
  return (
    <>
      <color attach="background" args={[BASE.ink]} />
      <Camera />
      <Sky state={state} />
      <Stars state={state} />
      <Galaxy id="under" state={state} />
      <Galaxy id="top" state={state} />
      {fxEnabled() ? <Effects launch={state} /> : null}
    </>
  )
}
