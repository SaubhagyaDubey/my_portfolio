import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { toonRamp } from './toonRamp.js'

// A ring station that turns slowly. Windows glow; a beacon blinks.
export default function Station({ stop, world }) {
  const { pos, r } = stop
  const ring = useRef()
  const beacon = useRef()
  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime()
    if (ring.current) ring.current.rotation.z += dt * 0.12
    if (beacon.current) beacon.current.material.emissiveIntensity = Math.sin(t * 4) > 0.6 ? 8 : 0.1
  })
  // a steel ring with hextech-lit windows: topside architecture in orbit
  const gm = toonRamp()
  const hull = { color: world.accent2, gradientMap: gm }
  const dark = { color: '#262b33', gradientMap: gm }
  const spokes = [0, 1, 2, 3, 4, 5]
  const windows = Array.from({ length: 24 }, (_, i) => (i / 24) * Math.PI * 2)
  return (
    <group position={[pos[0], pos[1], 0]} rotation={[0.55, 0, 0]}>
      <group ref={ring}>
        <mesh>
          <torusGeometry args={[r, r * 0.16, 16, 96]} />
          <meshToonMaterial {...hull} />
        </mesh>
        {spokes.map((i) => (
          <mesh key={i} rotation={[0, 0, (i / 6) * Math.PI * 2]} position={[0, 0, 0]}>
            <boxGeometry args={[r * 2, r * 0.05, r * 0.05]} />
            <meshToonMaterial {...dark} />
          </mesh>
        ))}
        {windows.map((a, i) => (
          <mesh key={i} position={[Math.cos(a) * r, Math.sin(a) * r, r * 0.17]}>
            <boxGeometry args={[r * 0.06, r * 0.03, 0.02]} />
            <meshStandardMaterial color={world.glow} emissive={world.accent} emissiveIntensity={i % 3 === 0 ? 0.3 : 2.2} />
          </mesh>
        ))}
      </group>
      <mesh>
        <cylinderGeometry args={[r * 0.28, r * 0.28, r * 0.5, 24]} />
        <meshToonMaterial {...hull} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r * 0.1, r * 0.1, r * 1.4, 12]} />
        <meshToonMaterial {...dark} />
      </mesh>
      <mesh ref={beacon} position={[0, 0, r * 0.75]}>
        <sphereGeometry args={[r * 0.06, 10, 10]} />
        <meshStandardMaterial color={world.accent} emissive={world.accent} emissiveIntensity={0.1} />
      </mesh>
    </group>
  )
}
