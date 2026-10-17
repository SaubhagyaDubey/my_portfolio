import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { toonRamp } from '../three/toonRamp.js'
import { BOSS, SPECIES } from './creatures.js'
import { BOSS_SEGMENTS, MAX_PICKUPS, game, segmentPos } from './state.js'

const dummy = new THREE.Object3D()
const tint = new THREE.Color()
const WHITE = new THREE.Color(1, 1, 1)

function glowColor(hex, k = 2.2) {
  return new THREE.Color(hex).multiplyScalar(k)
}

// One species: an instanced toon body and an instanced glowing core sharing its transforms.
function Species({ kind, city }) {
  const sp = SPECIES[kind]
  const body = useRef()
  const core = useRef()
  const geo = useMemo(() => sp.build(), [sp])
  const coreGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(sp.coreR, 12, 10)
    g.translate(0, sp.coreY, 0)
    return g
  }, [sp])
  const coreColor = useMemo(() => glowColor(sp.core === 'enemy' ? city.accent2 : sp.core), [sp, city])
  useEffect(
    () => () => {
      geo.dispose()
      coreGeo.dispose()
    },
    [geo, coreGeo],
  )
  useLayoutEffect(() => {
    for (let i = 0; i < sp.max; i++) body.current.setColorAt(i, WHITE)
    body.current.instanceColor.needsUpdate = true
    body.current.count = 0
    core.current.count = 0
  }, [sp])

  useFrame(() => {
    const b = body.current
    const c0 = core.current
    if (!b || !c0) return
    let n = 0
    for (const c of game.creatures) {
      if (!c.on || c.kind !== kind) continue
      if (n >= sp.max) break
      const t = c.t
      dummy.position.set(c.x, c.y, c.z)
      if (kind === 'jelly') {
        const pulse = Math.sin(t * 4 + c.phase)
        dummy.rotation.set(0.25, t * 0.5, Math.sin(t * 1.5 + c.phase) * 0.15)
        dummy.scale.set(1 + pulse * 0.08, 1 - pulse * 0.1, 1 + pulse * 0.08)
      } else if (kind === 'dart') {
        dummy.rotation.set(0, 0, t * 3 + c.phase)
        dummy.scale.setScalar(1)
      } else if (kind === 'spitter') {
        dummy.rotation.set(t * 0.8, t * 1.1, 0)
        dummy.scale.setScalar(1 + (c.hold > 0 && c.fireCd < 0.3 ? (0.3 - c.fireCd) * 0.6 : 0))
      } else {
        dummy.rotation.set(t * 0.5 + c.phase, t * 0.7, t * 0.3)
        dummy.scale.setScalar(1)
      }
      dummy.updateMatrix()
      b.setMatrixAt(n, dummy.matrix)
      c0.setMatrixAt(n, dummy.matrix)
      tint.setScalar(1 + c.flash * 3)
      b.setColorAt(n, tint)
      n++
    }
    b.count = n
    c0.count = n
    b.instanceMatrix.needsUpdate = true
    c0.instanceMatrix.needsUpdate = true
    if (b.instanceColor) b.instanceColor.needsUpdate = true
  })

  const gm = toonRamp()
  return (
    <>
      <instancedMesh ref={body} args={[geo, undefined, sp.max]} frustumCulled={false}>
        <meshToonMaterial color={sp.color} gradientMap={gm} />
      </instancedMesh>
      <instancedMesh ref={core} args={[coreGeo, undefined, sp.max]} frustumCulled={false}>
        <meshBasicMaterial color={coreColor} toneMapped={false} />
      </instancedMesh>
    </>
  )
}

export function Creatures({ city }) {
  return Object.keys(SPECIES).map((k) => <Species key={k} kind={k} city={city} />)
}

// The leviathan: a horned head with one glowing eye (the only place it can be hurt), and a plated body
// that follows the head's path a beat behind.
export function Boss({ city }) {
  const head = useRef()
  const headMat = useRef()
  const segs = useRef()
  const segCores = useRef()
  const geo = useMemo(() => ({ head: BOSS.build(), seg: BOSS.segment(), core: new THREE.SphereGeometry(0.75, 10, 8).translate(0, 0, 1.5) }), [])
  const eyeColor = useMemo(() => glowColor(city.accent2, 2.6), [city])
  const segGlow = useMemo(() => glowColor(city.accent2, 1.4), [city])
  const flashColor = useMemo(() => new THREE.Color(city.accent2), [city])
  useEffect(
    () => () => {
      for (const g of Object.values(geo)) g.dispose()
    },
    [geo],
  )

  useFrame(() => {
    const b = game.boss
    if (head.current) {
      head.current.visible = b.on
      head.current.position.set(b.x, b.y, b.z)
      const shake = b.dying > 0 ? (Math.random() - 0.5) * 0.4 : 0
      head.current.rotation.set(Math.sin(b.t * 1.3) * 0.12 + shake, Math.sin(b.t * 0.45) * 0.3, Math.cos(b.t * 0.45) * 0.15)
    }
    if (headMat.current) {
      headMat.current.emissive.copy(flashColor)
      headMat.current.emissiveIntensity = 0.08 + b.flash * 1.6
    }
    const s = segs.current
    const sc = segCores.current
    if (!s || !sc) return
    const n = b.on ? BOSS_SEGMENTS : 0
    for (let i = 0; i < n; i++) {
      const p = segmentPos(i)
      dummy.position.set(p.x, p.y, p.z)
      dummy.rotation.set(0, 0, b.t * 0.8 + i * 0.45)
      dummy.scale.setScalar((1 - i * 0.025) * BOSS.scale)
      dummy.updateMatrix()
      s.setMatrixAt(i, dummy.matrix)
      sc.setMatrixAt(i, dummy.matrix)
    }
    s.count = n
    sc.count = n
    s.instanceMatrix.needsUpdate = true
    sc.instanceMatrix.needsUpdate = true
  })

  const gm = toonRamp()
  return (
    <>
      <group ref={head} visible={false} scale={BOSS.scale}>
        <mesh geometry={geo.head}>
          <meshToonMaterial ref={headMat} color={BOSS.color} gradientMap={gm} emissive={city.accent2} emissiveIntensity={0.08} />
        </mesh>
        <mesh position={[0, 0.2, 3.6]}>
          <sphereGeometry args={[1.05, 16, 12]} />
          <meshBasicMaterial color={eyeColor} toneMapped={false} />
        </mesh>
      </group>
      <instancedMesh ref={segs} args={[geo.seg, undefined, BOSS_SEGMENTS]} frustumCulled={false}>
        <meshToonMaterial color={BOSS.color} gradientMap={gm} />
      </instancedMesh>
      <instancedMesh ref={segCores} args={[geo.core, undefined, BOSS_SEGMENTS]} frustumCulled={false}>
        <meshBasicMaterial color={segGlow} toneMapped={false} />
      </instancedMesh>
    </>
  )
}

// Repair (green cross-ish gem) and twin cannons (the city's glow). Spins so it reads as a pickup.
export function Pickups({ city }) {
  const refs = useRef([])
  const colors = useMemo(() => ({ repair: glowColor('#5cff8a', 2), twin: glowColor(city.glow, 2) }), [city])
  useFrame(() => {
    for (let i = 0; i < MAX_PICKUPS; i++) {
      const g = refs.current[i]
      const k = game.pickups[i]
      if (!g) continue
      g.visible = k.on
      if (!k.on) continue
      g.position.set(k.x, k.y, k.z)
      g.rotation.set(k.t * 1.5, k.t * 2.2, 0)
      const m = g.children[0].material
      m.color.copy(colors[k.kind])
      g.children[1].material.color.copy(colors[k.kind])
    }
  })
  return Array.from({ length: MAX_PICKUPS }, (_, i) => (
    <group
      key={i}
      visible={false}
      ref={(el) => {
        refs.current[i] = el
      }}
    >
      <mesh>
        <octahedronGeometry args={[0.8, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </mesh>
      <mesh>
        <torusGeometry args={[1.25, 0.06, 6, 24]} />
        <meshBasicMaterial toneMapped={false} />
      </mesh>
    </group>
  ))
}
