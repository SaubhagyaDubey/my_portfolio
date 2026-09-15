export default function Section({ id, title, children }) {
  return (
    <section id={id} className="section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  )
}
