# Morgen-Briefing – Personal Dashboard

Persönliches Dashboard („Soft Canvas / Lime"-Look, hell + dunkel) mit **echten,
verzögerten Börsenkursen** und interaktivem Chart. Links eine Icon-Leiste zum
Wechseln zwischen Bereichen (Übersicht, Aktien, Watchlist, Kalender, E-Mail,
News, Finanznews, To-Do); noch nicht gebaute Bereiche zeigen eine
Platzhalter-Seite.

**Stack:** React + Vite + TypeScript, Charts mit Recharts. Ein kleiner
Express-Server liefert das Frontend **und** kapselt die Kursquelle
(`/api/stocks`). Läuft als Docker-Container 24/7.

## Datenquellen

| Bereich | Quelle | Status |
| ------- | ------ | ------ |
| **Aktienkurse** (Nordex, iShares Nasdaq 100, iShares MSCI World) | Yahoo Finance über `server/stocks.js` | **echt**, ~15 Min verzögert |
| **Watchlist** – Aktien/ETFs (eigene Auswahl, durchsuchbar) | Finnhub über `server/integrations/finnhub.js` | **echt**, Echtzeit für US-Börsen (USD) |
| **Watchlist** – Krypto | CoinGecko über `server/integrations/coingecko.js`, kein Key nötig | **echt**, 24/7 (EUR) |
| Kalender, Wichtige Mails | iCloud (CalDAV/IMAP) | **echt** |
| News, Finanznews | RSS (Tagesschau, Handelsblatt) | **echt** |
| To-Do | eigene Liste, `data/todos.json` | **echt** |
| **Second Brain** | Obsidian-Vault via Syncthing (`vault/`, nur lesend) | **echt** |

Feste Watchlist der Sektion „Aktien" anpassen: `WATCHLIST` in
`server/stocks.js`. Späterer Wechsel auf einen bezahlten Echtzeit-Anbieter:
nur `fetchQuotes()` / `fetchHistory()` ersetzen.

Die Watchlist-Sektion pflegst du dagegen im Dashboard selbst (Suchfeld →
„Hinzufügen"); die Auswahl liegt in `data/watchlist.json`. Einrichtung des
Finnhub-Keys: siehe [CONNECT.md](CONNECT.md).

## Projektstruktur

```
client/
  src/
    App.tsx               # Layout: Shell + Sidebar + aktiver Bereich
    nav.tsx               # ← Bereiche der linken Leiste (Registry)
    index.css             # Design-Tokens (hell/dunkel) + Komponenten
    lib/                  # useTheme, useStocks/useHistory, finnhub, time, format
    components/           # Rail (Sidebar), TopBar, PriceChart, SymbolSearch, icons
    modules/
      MarketsSection.tsx    # Kurse (echt) + interaktiver Recharts-Chart
      WatchlistSection.tsx  # Symbolsuche + eigene Watchlist (Finnhub)
      VaultSection.tsx      # Aufgaben + Projekte aus dem Obsidian-Vault
server/
  index.js                # Express: /api/stocks, /api/watchlist, … + Static
  stocks.js               # Yahoo-Client (Session + Cache)
  watchlist-store.js      # Watchlist-Auswahl als JSON (Docker-Volume)
  integrations/
    finnhub.js            # Finnhub-Client: Aktien/ETF-Suche + Kurse (Cache)
    coingecko.js          # CoinGecko-Client: Coin-Suche + Kurse (keylos)
    obsidian.js           # Vault-Parser: Aufgaben, Projekte, Frontmatter
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

## Design

Weiche neutrale Fläche, darauf ein schwebender Container mit Bento-Karten.
Ein Akzent (Lime) für Daten und Aktiv-Zustände, primäre Aktionen in Ink.
Signature: 45°-schraffierte Datenflächen. Schriften: Outfit (Zahlen/Titel) +
Inter (UI). Tokens siehe `client/src/index.css`.

## Einen neuen Bereich (linke Leiste) hinzufügen

1. Eintrag ins `NAV`-Array in `client/src/nav.tsx` ergänzen
   (`{ id, label, icon }`; Icon aus `components/icons.tsx`).
   → Er erscheint sofort in der Leiste und zeigt eine Platzhalter-Seite.
2. Echten Inhalt bauen: eine Bereichs-Komponente erstellen und in `App.tsx`
   statt der `PlaceholderSection` für diese `id` rendern.
