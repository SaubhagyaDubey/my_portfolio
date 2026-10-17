import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import ShipModel from '../three/ShipModel.jsx'
import { SHIP_S, game, shipRoll, useGame } from './state.js'

// ShipModel's nose is +x with the canopy up +z. Here the nose points down the lane (-z) and up is +y.
const BASIS = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)),
)
const thrust = () => 0.22 + game.boost * 0.78

// The same ship as the galaxies, flown from behind. Blinks while it can't be hit.
export default function PlayerShip({ city }) {
  const outer = useRef()
  const cockpit = useGame((s) => s.cam === 'cockpit')

  useFrame(({ clock }) => {
    const g = outer.current
    if (!g) return
    const p = game.player
    g.position.set(p.x, p.y, 0)
    g.rotation.set(p.pitch * 0.6, -p.bank * 0.15, shipRoll(p))
    const blink = p.inv > 0 && Math.floor(clock.elapsedTime * 16) % 2 === 0
    g.visible = p.alive && !(blink && !cockpit)
  })

  return (
    <group ref={outer}>
      <group quaternion={BASIS} scale={SHIP_S}>
        <ShipModel accent={city.accent} accent2={city.accent2} glow={city.glow} thrust={thrust} cockpit={cockpit} />
      </group>
    </group>
  )
}
