import { profile, socials } from '../data/portfolio.js'
import Section from './Section.jsx'

export default function Contact() {
  return (
    <Section id="contact" title="Contact">
      <p>
        {`Based in ${profile.location}. I'm open to new opportunities and collaborations. The best way to reach me is by email.`}
      </p>
      <a className="button" href={`mailto:${profile.email}`}>
        {profile.email}
      </a>
      <ul className="social-links">
        {socials.map((social) => (
          <li key={social.label}>
            <a href={social.url} target="_blank" rel="noreferrer">
              {social.label}
            </a>
          </li>
        ))}
      </ul>
    </Section>
  )
}
