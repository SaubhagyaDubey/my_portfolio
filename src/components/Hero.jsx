import { profile, stats } from '../data/portfolio.js'

export default function Hero() {
  return (
    <section id="top" className="hero">
      <p className="eyebrow">{profile.role}</p>
      <h1>{`Hi, I'm ${profile.name}.`}</h1>
      <p className="lead">{profile.tagline}</p>
      <div className="actions">
        <a className="button" href="#experience">
          View my experience
        </a>
        <a className="button button-secondary" href="#contact">
          Get in touch
        </a>
      </div>
      <ul className="stats" aria-label="Highlights">
        {stats.map((stat) => (
          <li key={stat.label}>
            <span className="stat-value">{stat.value}</span>
            <span className="stat-label">{stat.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
