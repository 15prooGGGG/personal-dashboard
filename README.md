# Morgen-Briefing – Personal Dashboard

Ein persönliches Briefing-Dashboard als Single-Page-App: Wetter, Kalender,
wichtige Mails, Vertretungsplan, Finanznews, Aktienkurse, Welt-News, Budget
(experimentell) und Klausuren-Countdown – morgens auf einen Blick.

**Stack:** React + Vite + TypeScript (reine Frontend-App, Daten aktuell als
Mock). Der gebaute Build wird von einem kleinen Express-Server ausgeliefert und
läuft als Docker-Container 24/7.

**Design:** „Pre-Dawn Command Center" – warmer Indigo-Grund, vom Sonnenaufgang
beleuchtet (Signature: *Dawn Horizon*, tageszeitabhängig). Grün/Rot sind
ausschließlich Kursbewegungen vorbehalten. Erstellt mit den Skills
`frontend-design` und `ui-ux-pro-max`.

## Projektstruktur

```
client/
  index.html
  src/
    App.tsx              # Layout, Scroll-Spy, Toggle für experimentelle Module
    types.ts             # Modul- und Datentypen
    data/mock.ts         # ← zentrale Datenquelle (Integrationspunkte markiert)
    lib/time.ts          # Zeit-/Countdown-Helfer
    components/
      Sidebar.tsx        # Navigation + Dawn-Horizon-Header
      Card.tsx           # Basiskarte für jedes Modul
      Ticker.tsx         # Markt-Ticker
      icons.tsx          # SVG-Icons (kein Emoji)
    modules/
      registry.tsx       # ← hier Module ein-/aushängen
      *Module.tsx        # die einzelnen Briefing-Karten
server/
  index.js               # Express: liefert client/dist + /api/health
Dockerfile, docker-compose.yml
```

## Entwicklung (lokal)

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend (optional, für spätere echte APIs): http://localhost:3000

## Produktion mit Docker (24/7)

```bash
docker compose up -d --build
```

Erreichbar unter **http://<server-ip>:3000** (LAN bzw. Tailscale).
`restart: unless-stopped` startet den Container nach Reboot automatisch neu.

## Ein neues Modul hinzufügen

Die Modul-Struktur ist bewusst erweiterbar. Drei kleine Schritte:

1. **Daten** in `client/src/data/mock.ts` ergänzen (Typ in `types.ts` anlegen).
2. **Komponente** unter `client/src/modules/MeinModul.tsx` erstellen – sie liest
   aus `mock.ts` und rendert den Karteninhalt. Optional ein passendes Icon in
   `components/icons.tsx` ergänzen.
3. **Registrieren:** einen Eintrag ins `MODULES`-Array in
   `client/src/modules/registry.tsx` einfügen:

   ```ts
   { id: 'mein-modul', title: 'Mein Modul', icon: MeinIcon,
     Component: MeinModul, span: 'sm' /* 'sm' | 'md' | 'lg' */ }
   ```

Navigation, Grid-Karte und Scroll-Spy entstehen automatisch aus der Registry.
Mit `experimental: true` wird ein Modul sichtbar markiert und lässt sich über
den Schalter oben rechts aus-/einblenden.

## Echte Daten anbinden

Alle Module lesen ausschließlich aus `data/mock.ts`. Jeder Datensatz hat einen
`INTEGRATION`-Kommentar mit Vorschlägen für die echte Quelle, u. a.:

| Modul          | Vorgeschlagene Quelle                          |
| -------------- | ---------------------------------------------- |
| Wetter         | Open-Meteo (kostenlos, kein API-Key)           |
| Kalender       | CalDAV / Google Calendar / ICS-Feed            |
| Wichtige Mails | Gmail/IMAP (nur als wichtig geflaggte Mails)   |
| Vertretungsplan| DSBmobile / WebUntis                           |
| Finanznews     | RSS (Handelsblatt, Finanzen.net …)             |
| Aktienkurse    | Finnhub / Twelve Data / Yahoo Finance          |
| Welt-News      | Tagesschau / Reuters RSS                       |
| Klausuren      | manuelle Eingabe                               |

Empfehlung: Datenabruf serverseitig in `server/index.js` unter `/api/...` kapseln
(API-Keys bleiben so geheim) und in den Modulen per `fetch('/api/...')` laden.
```
