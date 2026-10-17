import { Suspense, useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { air, setAir, stepAir } from './air.js'
import Comet from './Comet.jsx'
import Effects from './Effects.jsx'
import Gate from './Gate.jsx'
import Marker from './Marker.jsx'
import Nebula from './Nebula.jsx'
import Planet, { Earth } from './Planet.jsx'
import Probe from './Probe.jsx'
import Quasar from './Quasar.jsx'
import RouteLine from './RouteLine.jsx'
import Ship from './Ship.jsx'
import Simulation from './Simulation.jsx'
import Starfield from './Starfield.jsx'
import Station from './Station.jsx'
import TwinSuns from './TwinSuns.jsx'
import { WORLDS } from '../data/worlds.js'
import { fxEnabled } from '../lib/tier.js'
import { useStore } from '../state/store.js'

function Stop({ stop, world, reduced }) {
  const light = world.sun
  const p = { stop, world, reduced }
  switch (stop.kind) {
    case 'earth':
      return <Earth {...p} light={light} />
    case 'planet':
      return <Planet {...p} light={light} />
    case 'twin':
      return <TwinSuns {...p} />
    case 'quasar':
      return <Quasar {...p} />
    case 'comet':
      return <Comet {...p} light={light} />
    case 'probe':
      return <Probe {...p} />
    case 'nebula':
      return <Nebula {...p} />
    case 'station':
      return <Station {...p} />
    case 'gate':
      return <Gate {...p} to={WORLDS[stop.to]} />
    default:
      return null
  }
}

// The background and ambient light, in the live air: the galaxy's own, or the docked planet's.
function Atmosphere({ world }) {
  const bg = useRef()
  const ambient = useRef()
  useLayoutEffect(() => setAir(world, true), [world])
  useFrame((_, delta) => {
    const { docked } = useStore.getState()
    const stop = docked ? world.stops.find((s) => s.id === docked) : null
    setAir(stop?.air ?? world)
    stepAir(Math.min(delta, 0.05))
    bg.current?.copy(air.sky0)
    ambient.current?.color.copy(air.ambient)
  })
  return (
    <>
      <color ref={bg} attach="background" args={[world.sky[0]]} />
      <ambientLight ref={ambient} intensity={0.35} color={world.ambient} />
    </>
  )
}

// Everything inside the Canvas for one galaxy.
export default function WorldScene({ world, reduced, arrival = null }) {
  const sun = world.sun
  const fx = fxEnabled()
  return (
    <>
      <Atmosphere world={world} />
      <directionalLight position={[sun[0] * 200, sun[1] * 200, sun[2] * 200]} intensity={2.4} color={world.sunColor} />
      <Starfield world={world} reduced={reduced} air={air} />
      <RouteLine stops={world.stops} tint={world.accent} />
      <Suspense fallback={null}>
        {world.stops.map((stop) => (
          <Stop key={stop.id} stop={stop} world={world} reduced={reduced} />
        ))}
      </Suspense>
      {world.stops.map((stop) => (
        <Marker key={`m-${stop.id}`} stop={stop} tint={stop.kind === 'gate' ? WORLDS[stop.to].accent : world.accent} />
      ))}
      <Ship world={world} />
      <Simulation world={world} reduced={reduced} arrival={arrival} />
      {fx ? <Effects city={world.key} air={air} /> : null}
    </>
  )
}
