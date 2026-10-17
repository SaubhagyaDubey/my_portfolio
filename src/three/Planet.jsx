import { useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { cloudsFrag, earthFrag, haloFrag, planetFrag, ringFrag, ringVert, sphereVert } from './shaders.js'
import { BASE } from '../data/palette.js'
import { color, useShaderMaterial, vec3 } from './useShaderMaterial.js'

const KIND = { rocky: 0, gas: 1, ice: 2 }

function Halo({ r, tint, light, strength = 1 }) {
  const uniforms = useMemo(
    () => ({ uColor: { value: color(tint) }, uLight: { value: vec3(light) }, uStrength: { value: strength } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const material = useShaderMaterial(sphereVert, haloFrag, uniforms, {
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  return (
    <mesh material={material} scale={1.34} renderOrder={2}>
      <sphereGeometry args={[r, 48, 32]} />
    </mesh>
  )
}

function Clouds({ r, light, seed, map = null, speed = 0.05 }) {
  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uUseMap: { value: map ? 1 : 0 },
      uLight: { value: vec3(light) },
      uTime: { value: 0 },
      uSeed: { value: seed },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const material = useShaderMaterial(sphereVert, cloudsFrag, uniforms, { transparent: true, depthWrite: false })
  const ref = useRef()
  useFrame((_, dt) => {
    uniforms.uTime.value += dt
    if (ref.current) ref.current.rotation.y += dt * speed
  })
  return (
    <mesh ref={ref} material={material} scale={1.018} renderOrder={1}>
      <sphereGeometry args={[r, 56, 40]} />
    </mesh>
  )
}

function Ring({ r, tint, seed, light, planetPos }) {
  const inner = r * 1.45
  const outer = r * 2.35
  const uniforms = useMemo(
    () => ({
      uColor: { value: color(tint) },
      uInner: { value: inner },
      uOuter: { value: outer },
      uSeed: { value: seed },
      uLight: { value: vec3(light) },
      uPlanet: { value: new THREE.Vector3(planetPos[0], planetPos[1], 0) },
      uPlanetR: { value: r },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const material = useShaderMaterial(ringVert, ringFrag, uniforms, {
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  })
  return (
    <mesh material={material} rotation={[1.25, 0.18, 0.35]} renderOrder={1}>
      <ringGeometry args={[inner, outer, 160, 1]} />
    </mesh>
  )
}

// A procedurally shaded planet. `visual` comes from worlds.js.
export default function Planet({ stop, light, world }) {
  const { r, visual, pos } = stop
  const uniforms = useMemo(
    () => ({
      uLight: { value: vec3(light) },
      uTime: { value: 0 },
      uSeed: { value: visual.seed },
      uFreq: { value: visual.freq },
      uKind: { value: KIND[visual.type] ?? 0 },
      uC0: { value: color(visual.colors[0]) },
      uC1: { value: color(visual.colors[1]) },
      uC2: { value: color(visual.colors[2]) },
      uC3: { value: color(visual.colors[3]) },
      uAtmo: { value: color(visual.atmo) },
      uRim: { value: color(world.accent) },
      uRimW: { value: 0.18 },
      uHatch: { value: 0 }, // per-pixel hatching shimmered like grain on small spinning planets
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const material = useShaderMaterial(sphereVert, planetFrag, uniforms)
  const body = useRef()
  const spin = visual.type === 'gas' ? 0.06 : 0.025
  useFrame((_, dt) => {
    uniforms.uTime.value += dt
    if (body.current) body.current.rotation.y += dt * spin
  })
  const tilt = ((visual.seed * 37) % 10) / 10 - 0.5 // stable per planet, -0.5..0.5 rad
  return (
    <group position={[pos[0], pos[1], 0]}>
      <group rotation={[0, 0, tilt * 0.8]}>
        <mesh ref={body} material={material}>
          <sphereGeometry args={[r, 72, 56]} />
        </mesh>
        {visual.type !== 'gas' && <Clouds r={r} light={light} seed={visual.seed + 2.5} speed={0.04} />}
        <Halo r={r} tint={visual.atmo} light={light} strength={visual.type === 'gas' ? 0.7 : 1} />
      </group>
      {visual.ring && <Ring r={r} tint={visual.ring} seed={visual.seed} light={light} planetPos={pos} />}
    </group>
  )
}

// Position on a three.js SphereGeometry for a lat/lon, matching equirectangular uv.
export function latLonToVec(lat, lon, radius) {
  const theta = THREE.MathUtils.degToRad(90 - lat)
  const phi = THREE.MathUtils.degToRad(lon + 180)
  return new THREE.Vector3(
    -radius * Math.cos(phi) * Math.sin(theta),
    radius * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

const DELHI = { lat: 28.61, lon: 77.21 }

export const EARTH_TEXTURES = [
  '/textures/earth_atmos_2048.jpg',
  '/textures/earth_lights_2048.png',
  '/textures/earth_specular_2048.jpg',
  '/textures/earth_clouds_1024.png',
]

// Earth, with day/night maps and a small light where Delhi is.
export function Earth({ stop, light, world }) {
  const { r, pos } = stop
  const [map, lights, spec, cloudMap] = useLoader(THREE.TextureLoader, EARTH_TEXTURES)
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace
    lights.colorSpace = THREE.SRGBColorSpace
    for (const t of [map, lights, spec, cloudMap]) t.anisotropy = 8
  }, [map, lights, spec, cloudMap])

  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uLights: { value: lights },
      uSpec: { value: spec },
      uLight: { value: vec3(light) },
      uRim: { value: color(world.accent) },
      uNight: { value: color('#ffcf80') },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const material = useShaderMaterial(sphereVert, earthFrag, uniforms)

  // Turn the globe so Delhi faces the camera a little right of centre, near the terminator.
  const delhi = useMemo(() => latLonToVec(DELHI.lat, DELHI.lon, 1), [])
  const rotY = -Math.atan2(delhi.x, delhi.z) + 0.55
  const pin = useMemo(() => latLonToVec(DELHI.lat, DELHI.lon, r * 1.035), [r])
  const pinRef = useRef()
  useFrame(({ clock }) => {
    if (pinRef.current) {
      const s = 1 + 0.35 * Math.sin(clock.getElapsedTime() * 3)
      pinRef.current.scale.setScalar(s)
    }
  })

  return (
    <group position={[pos[0], pos[1], 0]}>
      <group rotation={[0.12, 0, 0.41]}>
        <group rotation={[0, rotY, 0]}>
          <mesh material={material}>
            <sphereGeometry args={[r, 96, 72]} />
          </mesh>
          <mesh ref={pinRef} position={pin}>
            <sphereGeometry args={[r * 0.05, 12, 12]} />
            <meshBasicMaterial color={BASE.core} toneMapped={false} />
          </mesh>
        </group>
        <Clouds r={r} light={light} seed={0} map={cloudMap} speed={0.02} />
        <Halo r={r} tint={world.accent} light={light} strength={0.55} />
      </group>
    </group>
  )
}
