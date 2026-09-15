import { experience } from '../data/portfolio.js'
import Section from './Section.jsx'

export default function Experience() {
  return (
    <Section id="experience" title="Experience">
      <ol className="timeline">
        {experience.map((job) => (
          <li key={`${job.company}-${job.start}`}>
            <article className="job">
              <header className="job-header">
                <h3>{job.role}</h3>
                <p className="job-dates">
                  {job.start} – {job.end}
                </p>
              </header>
              <p className="job-company">
                {job.company} · {job.location}
                {job.note && ` · ${job.note}`}
              </p>
              <ul className="job-points">
                {job.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              {job.tech && (
                <ul className="tags" aria-label="Technologies">
                  {job.tech.map((tech) => (
                    <li key={tech}>{tech}</li>
                  ))}
                </ul>
              )}
            </article>
          </li>
        ))}
      </ol>
    </Section>
  )
}
