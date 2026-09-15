import { profile } from '../data/portfolio.js'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        © {new Date().getFullYear()} {profile.name}
      </div>
    </footer>
  )
}
