import { useEffect, useMemo } from 'react'
import { navigate, usePath } from './lib/router.js'
import Explore from './scenes/Explore.jsx'
import Journey from './scenes/Journey.jsx'
import Play from './scenes/Play.jsx'
import TextVersion from './scenes/TextVersion.jsx'
import { useStore } from './state/store.js'

const REDIRECT = { '/blue': '/under', '/red': '/top' }

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export default function App() {
  const path = usePath()
  const splash = useStore((s) => s.splash)
  const webgl = useMemo(() => hasWebGL(), [])

  useEffect(() => {
    if (REDIRECT[path]) navigate(REDIRECT[path] + window.location.search, { replace: true })
  }, [path])

  let page
  if (!webgl || path === '/text') page = <TextVersion webgl={webgl} />
  else if (path === '/under' || path === '/top') page = <Explore key={path} worldKey={path.slice(1)} />
  else if (path === '/play') page = <Play />
  else if (REDIRECT[path]) page = null
  else page = <Journey />

  return (
    <>
      {page}
      <div
        className="splash"
        data-phase={splash?.phase ?? ''}
        style={splash ? { '--splash-color': splash.color, '--splash-x': splash.x, '--splash-y': splash.y } : undefined}
        aria-hidden="true"
      />
    </>
  )
}
