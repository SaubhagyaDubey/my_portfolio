import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { flatVert, gateFrag } from './shaders.js'
import { fxStep, toonRamp } from './toonRamp.js'
import { color, useShaderMaterial } from './useShaderMaterial.js'

// The door to the other city, drawn in that city's style: a hextech gem going up to topside,
// a chem vent going down to the undercity. Framed by two slow rings of steel or gunmetal.
export default function Gate({ stop, to, reduced }) {
  const { pos, r } = stop
  const tint = to.accent
  const gem = to.gateStyle === 'gem'
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uStep: { value: fxStep(reduced) },
      uMode: { value: gem ? 0 : 1 },
      uColor: { value: color(tint) },
      uColor2: { value: color(to.accent2) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tint],
  )
  const metal = gem ? '#b8c6d8' : '#4a515c'
  const material = useShaderMaterial(flatVert, gateFrag, uniforms, { transparent: true, depthWrite: false })
  const ringA = useRef()
  const ringB = useRef()
  useFrame((_, dt) => {
    uniforms.uTime.value += dt
    if (ringA.current) ringA.current.rotation.x += dt * 0.4
    if (ringB.current) ringB.current.rotation.y -= dt * 0.3
  })
  return (
    <group position={[pos[0], pos[1], 0]}>
      <mesh material={material} renderOrder={4}>
        <planeGeometry args={[r * 2.2, r * 2.2]} />
      </mesh>
      <mesh ref={ringA}>
        <torusGeometry args={[r * 1.25, 0.14, 10, 96]} />
        <meshToonMaterial color={metal} gradientMap={toonRamp()} emissive={tint} emissiveIntensity={0.12} />
      </mesh>
      <mesh ref={ringB} rotation={[0.4, 0, 0]}>
        <torusGeometry args={[r * 1.45, 0.07, 8, 96]} />
        <meshToonMaterial color={metal} gradientMap={toonRamp()} emissive={tint} emissiveIntensity={0.25} />
      </mesh>
      <pointLight color={tint} intensity={r * 30} distance={r * 12} decay={2} />
    </group>
  )
}
