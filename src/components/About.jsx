import { about, education } from '../data/portfolio.js'
import Section from './Section.jsx'

export default function About() {
  return (
    <Section id="about" title="About">
      {about.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <h3 className="subheading">Education</h3>
      <ul className="education">
        {education.map((item) => (
          <li key={item.degree}>
            <strong>{item.degree}</strong>
            <span>
              {item.school} · {item.start} – {item.end}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
