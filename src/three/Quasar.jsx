import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { coronaFrag, diskFrag, flatVert, jetFrag, jetVert, ringVert, sphereVert, sunFrag } from './shaders.js'
import { fxStep } from './toonRamp.js'
import { color, useShaderMaterial } from './useShaderMaterial.js'

function Jet({ len, r, tint, step, flip = false }) {
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uStep: { value: step }, uColor: { value: color(tint) }, uLen: { value: len } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const material = useShaderMaterial(jetVert, jetFrag, uniforms, {
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(r * 0.12, r * 0.55, len, 24, 1, true)
    g.translate(0, len / 2, 0)
    return g
  }, [len, r])
  useFrame((_, dt) => {
    uniforms.uTime.value += dt
  })
  // cylinder runs along local +y; rotate so it runs along the disk normal (+z of the tilted group)
  return <mesh geometry={geometry} material={material} rotation={[flip ? -Math.PI / 2 : Math.PI / 2, 0, 0]} renderOrder={3} />
}

// A bright core, a tilted accretion disk with differential rotation, and two jets.
export default function Quasar({ stop, world, reduced }) {
  const { pos, r } = stop
  const step = fxStep(reduced)
  const coreU = useMemo(
    () => ({ uTime: { value: 0 }, uStep: { value: step }, uColor: { value: color(world.glow) }, uHot: { value: color('#f4fff0') } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const core = useShaderMaterial(sphereVert, sunFrag, coreU)
  const coronaU = useMemo(
    () => ({ uTime: { value: 0 }, uStep: { value: step }, uColor: { value: color(world.accent) }, uSeed: { value: 8.2 } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const corona = useShaderMaterial(flatVert, coronaFrag, coronaU, {
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const inner = r * 0.55
  const outer = r * 3.2
  const diskU = useMemo(
    () => ({
      uTime: { value: 0 },
      uStep: { value: step },
      uHot: { value: color('#f4fff0') },
      uWarm: { value: color(world.accent2) },
      uInner: { value: inner },
      uOuter: { value: outer },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const disk = useShaderMaterial(ringVert, diskFrag, diskU, {
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
  const group = useRef()
  useFrame((_, dt) => {
    coreU.uTime.value += dt
    coronaU.uTime.value += dt
    diskU.uTime.value += dt
  })
  return (
    <group position={[pos[0], pos[1], 0]}>
      {/* tilt the whole system so the disk reads as a disk and the jets go up-right / down-left */}
      <group ref={group} rotation={[1.05, 0.25, -0.6]}>
        <mesh material={disk} renderOrder={2}>
          <ringGeometry args={[inner, outer, 180, 1]} />
        </mesh>
        <Jet len={r * 6} r={r * 0.7} tint={world.glow} step={step} />
        <Jet len={r * 6} r={r * 0.7} tint={world.glow} step={step} flip />
      </group>
      <mesh material={core}>
        <sphereGeometry args={[r * 0.42, 32, 24]} />
      </mesh>
      <mesh material={corona} renderOrder={3}>
        <planeGeometry args={[r * 5, r * 5]} />
      </mesh>
      <pointLight color={world.glow} intensity={r * 60} distance={r * 40} decay={2} />
    </group>
  )
}
