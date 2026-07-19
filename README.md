# Morgen-Briefing – Personal Dashboard

Ein persönliches Briefing-Dashboard („Clean Analytics"-Look, hell + dunkel):
**echte, verzögerte Börsenkurse** mit interaktivem Chart, dazu Wetter, Kalender,
Klausuren, Vertretungsplan, Finanz- und Welt-News, wichtige Mails und ein
experimentelles Budget-Modul.

**Stack:** React + Vite + TypeScript, Charts mit Recharts. Ein kleiner
Express-Server liefert das gebaute Frontend **und** kapselt die Kursquelle
(`/api/stocks`). Läuft als Docker-Container 24/7.

## Datenquellen

| Bereich | Quelle | Status |
| ------- | ------ | ------ |
| **Aktienkurse** | Yahoo Finance über `server/stocks.js` | **echt**, ~15 Min verzögert |
| Wetter, Kalender, Schule, News, Budget | `client/src/data/mock.ts` | Mock (Integrationspunkte markiert) |

Watchlist: **Nordex** (`NDX1.DE`), **iShares Nasdaq 100** (`SXRV.DE`),
**iShares Core MSCI World** (`EUNL.DE`) – anpassbar in `server/stocks.js`
(`WATCHLIST`). Kurse werden serverseitig 60 s, Verläufe 10 min gecacht.

Späterer Wechsel auf einen bezahlten Echtzeit-Anbieter (EODHD, Twelve Data):
nur `fetchQuotes()` / `fetchHistory()` in `server/stocks.js` ersetzen – die
API-Routen und das Frontend bleiben unverändert.

## Projektstruktur

```
client/src/
  App.tsx                 # Layout: Topbar + Märkte-Sektion + Briefing-Grid
  index.css               # Design-Tokens (hell/dunkel) + Komponenten
  lib/                    # useTheme, useStocks/useHistory, time, format
  components/             # TopBar, Card, icons
  modules/
    MarketsSection.tsx    # Kurse (echt) + interaktiver Recharts-Chart
    registry.tsx          # ← Briefing-Karten ein-/aushängen
    *Module.tsx           # Wetter, Kalender, Klausuren, ...
  data/mock.ts            # Mock-Daten der Nicht-Kurs-Module
server/
  index.js                # Express: /api/stocks, /api/stocks/history, Static
  stocks.js               # Yahoo-Client (Session + Cache)
Dockerfile, docker-compose.yml
```

## Entwicklung (lokal)

```bash
npm install
npm run dev          # Frontend :5173, Backend separat mit: npm run dev:server
```

Im Dev-Modus leitet Vite `/api` an das Backend (`:3000`) weiter.

## Produktion mit Docker (24/7)

```bash
docker compose up -d --build
```

Erreichbar unter **http://<server-ip>:3000** (LAN bzw. Tailscale).
`restart: unless-stopped` startet den Container nach Reboot automatisch neu.

## Ein neues Briefing-Modul hinzufügen

1. Daten in `client/src/data/mock.ts` ergänzen (Typ in `types.ts`).
2. Komponente `client/src/modules/MeinModul.tsx` bauen (liest aus `mock.ts`).
   Optional Icon in `components/icons.tsx` ergänzen.
3. Eintrag ins `MODULES`-Array in `client/src/modules/registry.tsx`:
   `{ id: 'mein-modul', title: 'Mein Modul', icon: MeinIcon, Component: MeinModul }`.
   Mit `experimental: true` wird es markiert und ist per Schalter ausblendbar.

Karte, Titel und Grid-Platz entstehen automatisch aus der Registry.
