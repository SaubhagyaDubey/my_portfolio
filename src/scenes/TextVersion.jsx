import { education, experience, profile, skillGroups } from '../data/portfolio.js'
import { cityVars } from '../data/palette.js'
import { CONTACT, LAUNCH, WORLDS, routeOf } from '../data/worlds.js'
import { navigate } from '../lib/router.js'
import './text.css'

// The whole site as plain text: for screen readers, slow connections, machines without WebGL,
// and anyone who would rather read than fly.
export default function TextVersion({ webgl = true }) {
  const back = (e) => {
    e.preventDefault()
    navigate('/')
  }
  return (
    <main className="text">
      <div className="text__inner">
        <header className="text__head">
          <p className="mono">
            {webgl ? (
              <>
                <a href="/" onClick={back}>
                  back to the start
                </a>
                {' · '}
                <a
                  href="/play"
                  onClick={(e) => {
                    e.preventDefault()
                    navigate('/play')
                  }}
                >
                  or play the shooter
                </a>
              </>
            ) : (
              <span>this browser cannot draw the space version, so here it is as text.</span>
            )}
          </p>
          <h1>{LAUNCH.name}</h1>
          <p className="text__sub mono">{LAUNCH.sub}</p>
          <p className="text__lede">{LAUNCH.hello}</p>
        </header>

        {['under', 'top'].map((key) => {
          const world = WORLDS[key]
          return (
            <section key={key} className="text__world" data-city={key} style={cityVars(key)}>
              <h2>
                <span className="mono">{key === 'under' ? 'the undercity' : 'topside'} ·</span> {world.title}
              </h2>
              {routeOf(key).map((stop, i) => (
                <article key={stop.id} className="text__stop">
                  <h3>
                    <span className="mono">{i + 1}</span> {stop.title}
                  </h3>
                  <p className="text__tag mono">{stop.fact ? `${stop.fact} · ${stop.tag}` : stop.tag}</p>
                  {stop.story.map((p) => (
                    <p key={p.slice(0, 24)}>{p}</p>
                  ))}
                  {stop.contact ? (
                    <p className="mono">
                      {CONTACT.email} ·{' '}
                      <a href={CONTACT.linkedin} target="_blank" rel="noreferrer">
                        linkedin
                      </a>{' '}
                      ·{' '}
                      <a href={CONTACT.github} target="_blank" rel="noreferrer">
                        github
                      </a>
                    </p>
                  ) : null}
                </article>
              ))}
            </section>
          )
        })}

        <section className="text__details">
          <h2>
            <span className="mono">and the details,</span> for anyone hiring
          </h2>
          <p className="text__tag mono">
            {profile.role} · {profile.location}
          </p>
          {experience.map((job) => (
            <article key={`${job.company}-${job.start}`} className="text__job">
              <h3>
                {job.role} <span>· {job.company}</span>
              </h3>
              <p className="text__tag mono">
                {job.start} – {job.end} · {job.location}
                {job.note ? ` · ${job.note}` : ''}
              </p>
              <ul>
                {job.points.map((pt) => (
                  <li key={pt.slice(0, 32)}>{pt}</li>
                ))}
              </ul>
            </article>
          ))}
          <h3>skills</h3>
          <dl className="text__skills">
            {skillGroups.map((g) => (
              <div key={g.label}>
                <dt className="mono">{g.label}</dt>
                <dd>{g.items.join(', ')}</dd>
              </div>
            ))}
          </dl>
          <h3>education</h3>
          {education.map((e) => (
            <p key={e.school}>
              {e.degree}, {e.school}, {e.start}–{e.end}
            </p>
          ))}
        </section>
      </div>
    </main>
  )
}
