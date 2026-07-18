// Basis-Container für alle Dashboard-Kacheln. Sorgt für einheitliches
// Aussehen; der Inhalt wird per children übergeben.
export default function Widget({ title, accent = false, children }) {
  return (
    <section className={`widget ${accent ? 'widget--accent' : ''}`}>
      <h2 className="widget__title">{title}</h2>
      <div className="widget__body">{children}</div>
    </section>
  )
}
