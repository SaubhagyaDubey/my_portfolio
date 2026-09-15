import { projects } from '../data/portfolio.js'
import Section from './Section.jsx'

export default function Projects() {
  return (
    <Section id="projects" title="Selected Work">
      <ul className="project-grid">
        {projects.map((project) => (
          <li key={project.title}>
            <article className="project-card">
              <h3>{project.title}</h3>
              <p>{project.description}</p>
              <ul className="tags" aria-label="Technologies">
                {project.tech.map((tech) => (
                  <li key={tech}>{tech}</li>
                ))}
              </ul>
              <div className="project-links">
                {project.liveUrl && (
                  <a href={project.liveUrl} target="_blank" rel="noreferrer">
                    Live demo
                  </a>
                )}
                {project.sourceUrl && (
                  <a href={project.sourceUrl} target="_blank" rel="noreferrer">
                    Source
                  </a>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>
    </Section>
  )
}
