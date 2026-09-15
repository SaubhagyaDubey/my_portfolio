import About from './components/About.jsx'
import Contact from './components/Contact.jsx'
import Experience from './components/Experience.jsx'
import Footer from './components/Footer.jsx'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import Projects from './components/Projects.jsx'
import Skills from './components/Skills.jsx'
import './App.css'

export default function App() {
  return (
    <>
      <Header />
      <main className="container">
        <Hero />
        <About />
        <Experience />
        <Projects />
        <Skills />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
