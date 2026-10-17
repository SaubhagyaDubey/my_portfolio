import { usePortrait } from '../data/portrait.js'

// The portrait in a painted plate: torn round edge, a thick brass-and-cream ring, a visor sheen.
// The ring picks up whichever city is hovered (data-tint).
export default function Helmet({ look = 'front', tint = '' }) {
  const src = usePortrait(look)
  return (
    <div className="helmet" data-tint={tint}>
      <div className="helmet__plate">
        <img src={src} alt="" width="342" height="342" />
        <div className="helmet__visor" aria-hidden="true" />
      </div>
    </div>
  )
}
