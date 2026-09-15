import { skillGroups } from '../data/portfolio.js'
import Section from './Section.jsx'

export default function Skills() {
  return (
    <Section id="skills" title="Skills">
      <div className="skill-groups">
        {skillGroups.map((group) => (
          <div key={group.label} className="skill-group">
            <h3>{group.label}</h3>
            <ul className="skills" aria-label={group.label}>
              {group.items.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}
