# Deine Dienste sicher verbinden

Alle Zugangsdaten stehen **nur** in der Datei `.env` auf dem Server. Diese Datei
ist von Git ausgeschlossen, wird nie ins Frontend geladen und nur zur Laufzeit
in den Container gereicht. Least Privilege: überall nur **lesend** und mit
**app-spezifischen Passwörtern** statt deinem echten Account-Passwort.

## So bearbeitest du die `.env`

Auf dem Server im Projektordner:

```bash
nano .env            # Werte eintragen
chmod 600 .env       # nur du darfst sie lesen (einmalig)
docker compose up -d --build   # Änderungen übernehmen
```

Danach im Dashboard den jeweiligen Bereich öffnen – oder prüfen mit
`curl http://localhost:3000/api/services`.

---

## 1) iCloud-Kalender (CalDAV)

1. [appleid.apple.com](https://appleid.apple.com) → **Anmeldung & Sicherheit** →
   **App-spezifische Passwörter** → neues Passwort erzeugen (z. B. „Dashboard").
2. In die `.env`:
   ```
   ICLOUD_CALDAV_USERNAME=deine-apple-id@icloud.com
   ICLOUD_CALDAV_APP_PASSWORD=das-app-passwort
   ICLOUD_CALENDAR_NAME=          # optional: nur ein Kalender (Teil des Namens)
   ```

Es werden die Termine der nächsten 14 Tage gelesen.

## 2) iCloud Mail (IMAP)

Nur **geflaggte** (als wichtig markierte) Mails werden angezeigt – nicht der
ganze Posteingang.

1. App-spezifisches Passwort wie oben (kann dasselbe sein oder ein neues).
2. In die `.env`:
   ```
   ICLOUD_IMAP_USERNAME=deine-icloud-adresse@icloud.com
   ICLOUD_IMAP_APP_PASSWORD=das-app-passwort
   ```
3. In der Mail-App wichtige Nachrichten mit der **Flagge** markieren.

## 3) News & Finanznews (RSS)

Läuft ohne Zugangsdaten mit Standard-Feeds (Tagesschau, Handelsblatt). Eigene
Quellen optional:

```
NEWS_FEEDS=https://feed-a.xml,https://feed-b.xml
FINANCE_FEEDS=https://feed-c.xml
```

## 4) Watchlist-Kurse (Finnhub)

Für die durchsuchbare Watchlist. Kein Bezahlkonto nötig.

1. Kostenlos registrieren auf [finnhub.io/register](https://finnhub.io/register).
2. Im Finnhub-Dashboard den **API Key** kopieren.
3. In die `.env`:
   ```
   FINNHUB_API_KEY=dein-key
   ```

Der Key bleibt auf dem Server – das Frontend spricht nur `/api/finnhub/search`
und `/api/watchlist` an. Deshalb **kein** `VITE_`-Präfix: Variablen mit diesem
Präfix backt Vite beim Build ins Browser-Bundle, wo sie jeder auslesen kann.

Grenzen des Free-Tiers: 60 Anfragen/Minute, Echtzeitkurse nur für US-Börsen.
Deutsche Symbole (`.DE`) liefern dort keine Kurse – dafür bleibt die
Yahoo-Sektion „Aktien" zuständig.

---

## Sicherheitshinweise

- Die `.env` **niemals** committen oder weitergeben (sie ist in `.gitignore`).
- App-spezifische Passwörter kannst du bei Apple jederzeit einzeln widerrufen.
- Erreichbar ist das Dashboard nur privat (LAN/Tailscale), nicht offen im
  Internet. Falls du es je öffentlich machst: vorher HTTPS + Zugangsschutz.
