import { EXPRESSIONS, portraitFrames } from '../data/portrait.js'

// The portrait in a round plate: a thick steel-and-white ring and a visor sheen. Every expression is
// in the DOM at once and only the current one is shown, so a change of face never flashes an
// undecoded image. The ring picks up whichever city is armed (data-tint).
export default function Helmet({ look = 'front', tint = '', ref }) {
  const on = portraitFrames[look] ? look : 'front'
  return (
    <div className="helmet" data-tint={tint} ref={ref}>
      <div className="helmet__plate">
        {EXPRESSIONS.map((name) => (
          <img key={name} src={portraitFrames[name]} alt="" width="342" height="342" decoding="async" data-on={name === on} />
        ))}
        <div className="helmet__visor" aria-hidden="true" />
      </div>
    </div>
  )
}
