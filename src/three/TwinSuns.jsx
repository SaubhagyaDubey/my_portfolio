import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { coronaFrag, flatVert, sphereVert, sunFrag } from './shaders.js'
import { fxStep } from './toonRamp.js'
import { color, useShaderMaterial } from './useShaderMaterial.js'

function Sun({ r, tint, hot, seed, step }) {
  const sunU = useMemo(
    () => ({ uTime: { value: seed }, uStep: { value: step }, uColor: { value: color(tint) }, uHot: { value: color(hot) } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const sun = useShaderMaterial(sphereVert, sunFrag, sunU)
  const coronaU = useMemo(
    () => ({ uTime: { value: seed }, uStep: { value: step }, uColor: { value: color(tint) }, uSeed: { value: seed } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const corona = useShaderMaterial(flatVert, coronaFrag, coronaU, {
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const ref = useRef()
  useFrame((_, dt) => {
    sunU.uTime.value += dt
    coronaU.uTime.value += dt
    if (ref.current) ref.current.rotation.y += dt * 0.08
  })
  return (
    <group>
      <mesh ref={ref} material={sun}>
        <sphereGeometry args={[r, 48, 36]} />
      </mesh>
      <mesh material={corona} renderOrder={3}>
        <planeGeometry args={[r * 7, r * 7]} />
      </mesh>
      <pointLight color={tint} intensity={r * 40} distance={r * 30} decay={2} />
    </group>
  )
}

// Two suns circling a shared centre: one warm (old and certain), one in the city's second light.
export default function TwinSuns({ stop, world, reduced }) {
  const step = fxStep(reduced)
  const { pos, r } = stop
  const a = useRef()
  const b = useRef()
  const d = r * 1.9
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.35
    if (a.current) a.current.position.set(Math.cos(t) * d, Math.sin(t) * d * 0.42, Math.sin(t) * 1.2)
    if (b.current) b.current.position.set(-Math.cos(t) * d, -Math.sin(t) * d * 0.42, -Math.sin(t) * 1.2)
  })
  return (
    <group position={[pos[0], pos[1], 0]}>
      <group ref={a}>
        <Sun r={r * 0.62} tint="#f0a04a" hot="#fff1d0" seed={1.3} step={step} />
      </group>
      <group ref={b}>
        <Sun r={r * 0.5} tint={world.accent2} hot="#fff0f6" seed={4.1} step={step} />
      </group>
    </group>
  )
}
