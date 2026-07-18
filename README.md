# Personal Dashboard

Persönliches Dashboard – **React + Vite** Frontend mit **Express** Backend,
als **Docker**-Container für 24/7-Betrieb.

## Projektstruktur

```
personal-dashboard/
├── client/            # React + Vite Frontend
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── index.css
│       └── components/ # Widget-Basis + Beispiel-Widgets
├── server/            # Express Backend (liefert API + gebautes Frontend)
│   └── index.js
├── Dockerfile         # Multi-Stage-Build (Frontend bauen -> schlankes Runtime-Image)
├── docker-compose.yml # Betrieb mit restart: unless-stopped (24/7)
└── package.json       # npm-Workspaces (client + server)
```

## Entwicklung (lokal, ohne Docker)

```bash
npm install
npm run dev
```

- Frontend (Vite): http://localhost:5173
- Backend (Express): http://localhost:3000
- `/api`-Anfragen werden im Dev-Modus automatisch ans Backend weitergeleitet.

## Produktion mit Docker (24/7)

```bash
docker compose up -d --build
```

- Erreichbar unter **http://<server-ip>:3000**
- `restart: unless-stopped` startet den Container nach Reboot automatisch neu.

Nützliche Befehle:

```bash
docker compose logs -f        # Logs verfolgen
docker compose ps             # Status anzeigen
docker compose down           # Container stoppen
docker compose up -d --build  # Nach Code-Änderungen neu bauen & starten
```

## API

| Endpoint       | Beschreibung                          |
| -------------- | ------------------------------------- |
| `GET /api/health` | Status, Serverzeit und Uptime      |

Weitere Endpunkte in `server/index.js` ergänzen.

## Nächste Schritte

- Inhalte/Widgets planen und die Platzhalter in `client/src/components/` ersetzen.
- Passende `/api`-Endpunkte im Server hinzufügen.
