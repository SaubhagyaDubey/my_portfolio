// Where the ship starts when a deep link (/top?stop=tide) asks for one stop: just short of it, on the
// route from the stop before, so the arrival is a short autopilot hop that docks on its own.
export const APPROACH_GAP = 28 // units outside the stop's radius

export function approachPoint(world, id) {
  const i = world.stops.findIndex((s) => s.id === id)
  if (i < 0) return null
  const stop = world.stops[i]
  const from = i > 0 ? world.stops[i - 1].pos : world.start
  let dx = stop.pos[0] - from[0]
  let dy = stop.pos[1] - from[1]
  const d = Math.hypot(dx, dy) || 1
  dx /= d
  dy /= d
  const back = stop.r + APPROACH_GAP
  const { x, y } = world.bounds
  return [
    Math.min(x[1], Math.max(x[0], stop.pos[0] - dx * back)),
    Math.min(y[1], Math.max(y[0], stop.pos[1] - dy * back)),
  ]
}
