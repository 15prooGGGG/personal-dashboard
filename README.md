# Morgen-Briefing – Personal Dashboard

Persönliches Dashboard („Clean Analytics"-Look, hell + dunkel) mit **echten,
verzögerten Börsenkursen** und interaktivem Chart. Links eine Icon-Leiste zum
Wechseln zwischen Bereichen (Übersicht, Kalender, E-Mail, News, Finanznews,
To-Do); noch nicht gebaute Bereiche zeigen eine Platzhalter-Seite.

**Stack:** React + Vite + TypeScript, Charts mit Recharts. Ein kleiner
Express-Server liefert das Frontend **und** kapselt die Kursquelle
(`/api/stocks`). Läuft als Docker-Container 24/7.

## Datenquellen

| Bereich | Quelle | Status |
| ------- | ------ | ------ |
| **Aktienkurse** (Nordex, iShares Nasdaq 100, iShares MSCI World) | Yahoo Finance über `server/stocks.js` | **echt**, ~15 Min verzögert |
| Kalender, E-Mail, News, Finanznews, To-Do | – | noch leer (Platzhalter) |

Watchlist anpassen: `WATCHLIST` in `server/stocks.js`. Späterer Wechsel auf
einen bezahlten Echtzeit-Anbieter: nur `fetchQuotes()` / `fetchHistory()`
ersetzen.

## Projektstruktur

```
client/
  public/banner.jpg       # Banner-Bild (durch eigenes ersetzbar)
  src/
    App.tsx               # Layout: Rail + Banner + aktiver Bereich
    nav.tsx               # ← Bereiche der linken Leiste (Registry)
    index.css             # Design-Tokens (hell/dunkel) + Komponenten
    lib/                  # useTheme, useStocks/useHistory, time, format
    components/           # Rail, TopBar (Banner), PlaceholderSection, icons
    modules/
      MarketsSection.tsx  # Kurse (echt) + interaktiver Recharts-Chart
server/
  index.js                # Express: /api/stocks, /api/stocks/history, Static
  stocks.js               # Yahoo-Client (Session + Cache)
Dockerfile, docker-compose.yml
```

## Entwicklung (lokal)

```bash
npm install
npm run dev          # Frontend :5173 (Backend: npm run dev:server, :3000)
```

## Produktion mit Docker (24/7)

```bash
docker compose up -d --build
```

Erreichbar unter **http://<server-ip>:3000**. `restart: unless-stopped`
startet den Container nach Reboot automatisch neu.

## Banner-Bild ersetzen

Eigenes Bild als `client/public/banner.jpg` ablegen (quer, z. B. ~1600×400),
dann neu bauen. Ein dunkler Verlauf über dem Bild hält die Schrift lesbar.

## Einen neuen Bereich (linke Leiste) hinzufügen

1. Eintrag ins `NAV`-Array in `client/src/nav.tsx` ergänzen
   (`{ id, label, icon }`; Icon aus `components/icons.tsx`).
   → Er erscheint sofort in der Leiste und zeigt eine Platzhalter-Seite.
2. Echten Inhalt bauen: eine Bereichs-Komponente erstellen und in `App.tsx`
   statt der `PlaceholderSection` für diese `id` rendern.
