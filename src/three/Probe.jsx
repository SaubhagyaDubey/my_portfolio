import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { toonRamp } from './toonRamp.js'

// A dead probe: body, two solar panels, a dish, one light that still blinks.
export default function Probe({ stop, world }) {
  const { pos, r } = stop
  const group = useRef()
  const led = useRef()
  const s = r / 3
  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime()
    if (group.current) {
      group.current.rotation.z += dt * 0.11
      group.current.rotation.x += dt * 0.05
    }
    if (led.current) led.current.material.emissiveIntensity = Math.sin(t * 2.2) > 0.85 ? 6 : 0.05
  })
  // rusted, patched, still blinking
  const gm = toonRamp()
  const metal = { color: '#8a919b', gradientMap: gm }
  const foil = { color: world.rivet, gradientMap: gm }
  const panel = { color: '#173a34', gradientMap: gm }
  return (
    <group ref={group} position={[pos[0], pos[1], 0]} scale={s}>
      <mesh>
        <boxGeometry args={[1.4, 1.4, 1.2]} />
        <meshToonMaterial {...foil} />
      </mesh>
      <mesh position={[0, 0, 0.62]}>
        <boxGeometry args={[1.0, 1.0, 0.1]} />
        <meshToonMaterial {...metal} />
      </mesh>
      {/* panels */}
      <mesh position={[-2.4, 0, 0]}>
        <boxGeometry args={[3.2, 1.1, 0.06]} />
        <meshToonMaterial {...panel} />
      </mesh>
      <mesh position={[2.4, 0, 0]}>
        <boxGeometry args={[3.2, 1.1, 0.06]} />
        <meshToonMaterial {...panel} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 8.2, 8]} />
        <meshToonMaterial {...metal} />
      </mesh>
      {/* dish */}
      <group position={[0, 1.3, 0.2]} rotation={[-0.5, 0, 0]}>
        <mesh>
          <sphereGeometry args={[1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
          <meshToonMaterial {...metal} side={2} />
        </mesh>
        <mesh position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.4, 6]} />
          <meshToonMaterial {...metal} />
        </mesh>
      </group>
      <mesh ref={led} position={[0.55, -0.55, 0.7]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial color={world.accent2} emissive={world.accent2} emissiveIntensity={0.05} />
      </mesh>
    </group>
  )
}
