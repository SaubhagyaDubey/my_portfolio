import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { CITIES } from '../data/palette.js'
import { fxEnabled, getTier } from '../lib/tier.js'
import { GradeEffect } from '../three/post/GradeEffect.js'
import { LensEffect } from '../three/post/LensEffect.js'
import Bullets from './Bullets.jsx'
import { Boss, Creatures, Pickups } from './Creatures.jsx'
import Explosions from './Explosions.jsx'
import GameLoop from './GameLoop.jsx'
import { pal } from './lanes.js'
import PlayerShip from './PlayerShip.jsx'
import Specials from './Specials.jsx'
import { AIM_Z, game, reticleEl } from './state.js'
import Tunnel from './Tunnel.jsx'

const v = new THREE.Vector3()

// Pins the DOM reticle to where the shots converge.
function Reticle() {
  const { camera, size } = useThree()
  useFrame(() => {
    const el = reticleEl.current
    if (!el) return
    const p = game.player
    v.set(p.x, p.y, AIM_Z).project(camera)
    el.style.transform = `translate3d(${((v.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((1 - (v.y * 0.5 + 0.5)) * size.height).toFixed(1)}px, 0)`
  })
  return null
}

// The galaxies' grade and lens, with bloom. No brush, ink, paper or grain here: a fast game needs clean,
// crisp frames. The grade's split tone follows the lane.
function GameEffects({ reduced }) {
  const tier = getTier()
  const grade = useMemo(() => new GradeEffect({ a: CITIES.under.grade, b: CITIES.top.grade, mix: 0, halftone: 0, paper: 0, vignette: 0.5 }), [])
  const lens = useMemo(() => new LensEffect({ ca: tier === 0 ? 0 : 0.004, grain: 0 }), [tier])
  useEffect(() => {
    lens.frozen = reduced
  }, [lens, reduced])
  useFrame(() => {
    grade.uniforms.get('uShadowA').value.copy(pal.shadow)
    grade.uniforms.get('uMidA').value.copy(pal.mid)
    grade.uniforms.get('uHighA').value.copy(pal.high)
  })
  useEffect(
    () => () => {
      grade.dispose()
      lens.dispose()
    },
    [grade, lens],
  )
  return (
    <EffectComposer multisampling={tier === 0 ? 0 : 4}>
      <Bloom mipmapBlur intensity={1.0} luminanceThreshold={0.6} luminanceSmoothing={0.35} radius={0.8} resolutionScale={tier === 0 ? 0.35 : 0.5} />
      <primitive object={grade} dispose={null} />
      <primitive object={lens} dispose={null} />
    </EffectComposer>
  )
}

// Background and lights in the lane's colours.
function LaneLight() {
  const bg = useRef()
  const ambient = useRef()
  const sun = useRef()
  const fill = useRef()
  useFrame(() => {
    bg.current?.copy(pal.sky0)
    ambient.current?.color.copy(pal.ambient)
    sun.current?.color.copy(pal.sun)
    fill.current?.color.copy(pal.accent)
  })
  return (
    <>
      <color ref={bg} attach="background" args={[pal.sky0]} />
      <ambientLight ref={ambient} intensity={0.55} />
      <directionalLight ref={sun} position={[-0.5, 1, 0.8]} intensity={2.6} />
      <directionalLight ref={fill} position={[0.6, -0.3, -1]} intensity={0.9} />
    </>
  )
}

export default function GameScene({ city, cityKey, reduced }) {
  return (
    <>
      <LaneLight />
      <Tunnel cityKey={cityKey} />
      <Creatures />
      <Boss />
      <Pickups />
      <Bullets />
      <Specials />
      <Explosions />
      <PlayerShip city={city} />
      <GameLoop />
      <Reticle />
      {fxEnabled() ? <GameEffects reduced={reduced} /> : null}
    </>
  )
}
