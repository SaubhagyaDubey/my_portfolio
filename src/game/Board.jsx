import { useState } from 'react'
import { callsignOf, saveCallsign, useBoard } from './board.js'

const pad = (n) => String(n).padStart(7, '0')

const REASONS = {
  offline: 'board offline. the score stays on this device.',
  'too-soon': 'that was quick. not saved, fly another.',
  'run-expired': 'that run took over four hours. not saved.',
  replay: 'already saved.',
  'not-your-run': 'cookies changed mid-run. not saved.',
  'not-configured': 'the board isn’t set up yet.',
}

// The board: top pilots by best run, one row each, this browser's row marked. `compact` is the
// short version inside the end card on small screens.
export function Board({ compact = false }) {
  const status = useBoard((s) => s.status)
  const entries = useBoard((s) => s.entries)
  const pilot = useBoard((s) => s.pilot)
  const rows = compact ? entries.slice(0, 5) : entries
  const mineShown = pilot && rows.some((e) => e.tag === pilot.tag)
  return (
    <section className="board" data-compact={compact} aria-label="leaderboard">
      <header className="board__head">
        <b>the board</b>
        <span className="mono">{status === 'offline' ? 'offline' : status === 'ready' ? 'best run per pilot' : 'loading…'}</span>
      </header>
      {status === 'ready' && !rows.length ? <p className="board__empty mono">nobody yet. first one gets the top spot.</p> : null}
      {rows.length ? (
        <ol className="board__list">
          {rows.map((e, i) => (
            <li key={e.tag} data-me={pilot?.tag === e.tag} data-city={e.city ?? ''}>
              <span className="board__rank">{i + 1}</span>
              <span className="board__name">{e.callsign}</span>
              <span className="board__wave mono">w{e.wave}</span>
              <span className="board__score">{pad(e.best)}</span>
            </li>
          ))}
          {pilot?.rank && pilot.best > 0 && !mineShown ? (
            <li data-me="true" data-city={pilot.city ?? ''} className="board__you">
              <span className="board__rank">{pilot.rank}</span>
              <span className="board__name">{pilot.callsign}</span>
              <span className="board__wave mono">w{pilot.wave}</span>
              <span className="board__score">{pad(pilot.best)}</span>
            </li>
          ) : null}
        </ol>
      ) : null}
      {compact ? null : <Callsign />}
    </section>
  )
}

// "flying as …" with an inline rename. Saved to the pilot cookie's account.
export function Callsign() {
  const status = useBoard((s) => s.status)
  const name = useBoard((s) => callsignOf(s))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  if (status === 'offline' || !name) return null

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveCallsign(draft)
      setEditing(false)
    } catch (err) {
      setError(err.code === 'bad-callsign' ? '3–16 characters: letters, numbers, space, - or _' : 'couldn’t save that, try again')
    } finally {
      setBusy(false)
    }
  }

  if (!editing) {
    return (
      <p className="board__me mono">
        flying as <b>{name}</b>{' '}
        <button
          type="button"
          onClick={() => {
            setDraft(name)
            setError(null)
            setEditing(true)
          }}
        >
          rename
        </button>
      </p>
    )
  }
  return (
    <form className="board__form" onSubmit={save}>
      <label className="mono" htmlFor="callsign">
        callsign
      </label>
      <input
        id="callsign"
        value={draft}
        maxLength={16}
        autoComplete="off"
        spellCheck={false}
        autoFocus
        onChange={(e) => setDraft(e.target.value.toLowerCase())}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            setEditing(false)
          }
        }}
      />
      <button type="submit" disabled={busy}>
        {busy ? 'saving' : 'save'}
      </button>
      {error ? <p className="board__error mono">{error}</p> : null}
    </form>
  )
}

// One line on the end card about what happened to this run's score.
export function SubmitNote() {
  const submit = useBoard((s) => s.submit)
  if (!submit || submit.state === 'skipped') return null
  if (submit.state === 'saving') return <p className="board__note mono">saving to the board…</p>
  if (submit.state === 'failed') return <p className="board__note board__note--off mono">{REASONS[submit.reason] ?? 'not saved this time.'}</p>
  return (
    <p className="board__note mono">
      {submit.isBest ? 'new personal best · ' : ''}
      {submit.rank ? `#${submit.rank} on the board` : 'saved'}
    </p>
  )
}
