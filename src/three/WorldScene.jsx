import { Suspense } from 'react'
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

// Everything inside the Canvas for one galaxy.
export default function WorldScene({ world, reduced }) {
  const sun = world.sun
  const fx = fxEnabled()
  return (
    <>
      <color attach="background" args={[world.sky[0]]} />
      <ambientLight intensity={0.35} color={world.ambient} />
      <directionalLight position={[sun[0] * 200, sun[1] * 200, sun[2] * 200]} intensity={2.4} color={world.sunColor} />
      <Starfield world={world} reduced={reduced} />
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
      <Simulation world={world} reduced={reduced} />
      {fx ? <Effects city={world.key} reduced={reduced} /> : null}
    </>
  )
}
