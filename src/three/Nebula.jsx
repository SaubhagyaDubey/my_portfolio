import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mulberry32 } from '../lib/seed.js'
import { flatVert, nebulaFrag } from './shaders.js'
import { color, useShaderMaterial } from './useShaderMaterial.js'

function Sheet({ size, offset, seed, a, b, density, rotation, core = false }) {
  const uniforms = useMemo(
    () => ({
      uTime: { value: seed * 3 },
      uSeed: { value: seed },
      uA: { value: color(a) },
      uB: { value: color(b) },
      uDensity: { value: density },
      uCore: { value: core ? 1 : 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  // painted masses occlude each other like paint; only the thin core sheet adds light
  const material = useShaderMaterial(flatVert, nebulaFrag, uniforms, {
    transparent: true,
    depthWrite: false,
    blending: core ? THREE.AdditiveBlending : THREE.NormalBlending,
  })
  useFrame((_, dt) => {
    uniforms.uTime.value += dt
  })
  return (
    <mesh material={material} position={offset} rotation={[0, 0, rotation]} renderOrder={1}>
      <planeGeometry args={[size, size]} />
    </mesh>
  )
}

// Undercity chem smoke: greens and teals with a shimmer-pink heart.
const PALETTES = [
  ['#0f3a3a', '#3fbf8f'],
  ['#1f5a46', '#8ff07a'],
  ['#3b2a4a', '#ff5fa8'],
  ['#163028', '#c8ff6a'],
]

// Layered painted cloud masses at different depths, one glowing core sheet, a few young stars.
export default function Nebula({ stop, world }) {
  const { pos, r } = stop
  const sheets = useMemo(() => {
    const rand = mulberry32(5)
    const masses = Array.from({ length: 4 }, (_, i) => {
      const pal = PALETTES[i % PALETTES.length]
      return {
        size: r * (1.6 + rand() * 1.5),
        offset: [(rand() - 0.5) * r * 1.2, (rand() - 0.5) * r * 0.9, -8 + i * 2.1],
        seed: 1 + i * 1.7,
        a: pal[0],
        b: pal[1],
        density: 0.55 + rand() * 0.3,
        rotation: rand() * Math.PI,
      }
    })
    masses.push({ size: r * 2.2, offset: [0, 0, 1.5], seed: 11.3, a: PALETTES[2][0], b: world.accent2, density: 0.7, rotation: 0.4, core: true })
    return masses
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r])
  const stars = useMemo(() => {
    const rand = mulberry32(9)
    return Array.from({ length: 6 }, () => ({
      p: [(rand() - 0.5) * r * 1.3, (rand() - 0.5) * r * 0.9, -2 + rand() * 4],
      s: 0.12 + rand() * 0.16,
      c: rand() > 0.5 ? '#f4f8ff' : world.glow,
    }))
  }, [r, world.glow])
  return (
    <group position={[pos[0], pos[1], 0]}>
      {sheets.map((s, i) => (
        <Sheet key={i} {...s} />
      ))}
      {stars.map((s, i) => (
        <mesh key={i} position={s.p}>
          <sphereGeometry args={[s.s, 10, 10]} />
          <meshBasicMaterial color={s.c} toneMapped={false} />
        </mesh>
      ))}
      <pointLight color={world.accent} intensity={r * 8} distance={r * 4} decay={2} />
    </group>
  )
}
