// Wird angezeigt, wenn ein Dienst noch keine Zugangsdaten hat.
// Zeigt eine kurze, sichere Einrichtungsanleitung – niemals Secrets.
export default function NotConnected({
  name,
  steps,
  envVars,
  errorDetail
}: {
  name: string
  steps: string[]
  envVars: string[]
  errorDetail?: string
}) {
  return (
    <div className="setup">
      {errorDetail ? (
        <p className="setup__lead">
          Verbindung zu {name} fehlgeschlagen. Prüfe die Zugangsdaten in der{' '}
          <code>.env</code>.
        </p>
      ) : (
        <p className="setup__lead">{name} ist noch nicht verbunden. So richtest du es sicher ein:</p>
      )}

      {errorDetail ? (
        <p className="muted setup__error">{errorDetail}</p>
      ) : (
        <ol className="setup__steps">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}

      <p className="muted">
        Werte in die <code>.env</code> auf dem Server eintragen, dann
        <code> docker compose up -d --build</code>:
      </p>
      <ul className="setup__env">
        {envVars.map((v) => (
          <li key={v}>
            <code>{v}</code>
          </li>
        ))}
      </ul>
    </div>
  )
}
