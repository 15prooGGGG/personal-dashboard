import Widget from './Widget.jsx'

// Platzhalter für künftige Widgets. Nach der Inhaltsplanung durch echte
// Komponenten ersetzen.
export default function PlaceholderWidget({ title, hint }) {
  return (
    <Widget title={title}>
      <div className="placeholder">{hint}</div>
    </Widget>
  )
}
