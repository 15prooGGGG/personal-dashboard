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

## 5) Signal-Push (für den Vertretungsplan)

Der Bot koppelt sich als **Zweitgerät** an deinen bestehenden Signal-Account –
genau wie Signal Desktop. Du brauchst **keine zweite Rufnummer** und
registrierst nichts neu.

**a) Container starten**

```bash
docker compose up -d signal
```

**b) Gerät koppeln.** Der Container erzeugt einen QR-Code. Öffne im Browser auf
dem Server (oder per Tailscale/SSH-Tunnel, der Port liegt bewusst nur auf
127.0.0.1):

```
http://127.0.0.1:8080/v1/qrcodelink?device_name=dashboard
```

Dann am Handy: **Signal → Einstellungen → Gekoppelte Geräte → Gerät koppeln**
und den QR-Code scannen.

**c) Nummer eintragen** – deine eigene, im internationalen Format:

```
SIGNAL_NUMBER=+491701234567
```

`SIGNAL_RECIPIENT` leer lassen: dann schickt der Bot an dich selbst („Notiz an
mich"). Danach `docker compose up -d --build dashboard`.

**d) Testen:**

```bash
curl http://localhost:3000/api/notify   # gekoppelt? welche Jobs?
```

**Kopplung ohne zweiten Bildschirm geht nicht.** Der `sgnl://linkdevice`-Link
öffnet auf iOS nur die Geräteliste, statt zu koppeln – Signal verlangt das
Scannen. Deshalb liegt der QR unter `/signal-setup`: die Seite auf einem
zweiten Gerät öffnen und mit dem Handy scannen.

**Warteschlange:** Ein gekoppeltes Gerät muss regelmäßig Nachrichten abholen,
sonst wirft Signal die Kopplung irgendwann ab. Der Job `signal-receive` leert
sie alle 30 Minuten; die Inhalte werden verworfen und nie gespeichert.

**Tempo:** Der Container läuft im `MODE=normal` und startet für jede Anfrage
einen signal-cli-Prozess – rund 5 s pro Aufruf. Das ist für ein paar
Nachrichten am Tag egal. `MODE=json-rpc` wäre schneller, erfordert aber eine
erneute Kopplung.

Der Ordner `signal-config/` enthält nach dem Koppeln **Schlüsselmaterial deines
Signal-Accounts**. Er ist in `.gitignore` und gehört nicht in ein Backup, das
andere lesen können.

## 6) Vertretungsplan (Schulportal Hessen)

> **Anders als alles andere hier:** Das Schulportal hat keine öffentliche API.
> Das Dashboard meldet sich wie ein Browser an und liest die Seite aus. Das
> funktioniert, ist aber empfindlich – ändert das Portal sein Markup, muss der
> Parser nachgezogen werden.
>
> **Dein SPH-Passwort ist kein API-Key.** Damit kommt man auch an Noten,
> Nachrichten und Schulmail. Es steht nur in der `.env` (`chmod 600`), wird nie
> geloggt und nie ans Frontend gegeben – aber überleg dir bewusst, ob du es auf
> dem Server hinterlegen willst.

**a) Schul-ID finden**

```bash
curl "http://localhost:3000/api/substitutions/schools?q=goetheschule"
```

**b) In die `.env`:**

```
SPH_SCHOOL_ID=5152
SPH_USERNAME=vorname.nachname
SPH_PASSWORD=dein-passwort
```

`SPH_USERNAME` **ohne** die Schul-ID davor – die setzt der Server selbst
zusammen. Dann `docker compose up -d --build dashboard`.

**c) Prüfen:**

```bash
curl http://localhost:3000/api/substitutions/status   # angemeldet? gesperrt?
curl http://localhost:3000/api/substitutions          # geparster Plan
curl http://localhost:3000/api/substitutions/raw      # rohes HTML
```

**Schutz vor Kontosperre:** Wird die Anmeldung abgelehnt, deaktiviert sich die
Integration selbst und versucht es **nicht** erneut. Sonst würde ein Job, der
alle paar Minuten ein falsches Passwort probiert, dein Konto sperren. Nach dem
Korrigieren der `.env` den Container neu starten.

**Zwei-Faktor-Anmeldung:** Falls du für das Schulportal 2FA aktiviert hast,
scheitert die automatische Anmeldung – das lässt sich nicht umgehen.

**Morgen-Push.** Sobald Signal (Abschnitt 5) eingerichtet ist, kommt der Plan
werktags um 6:45 aufs Handy:

```
NOTIFY_PLAN=on
NOTIFY_PLAN_TIME=06:45
NOTIFY_PLAN_QUIET=off     # "on" = nur melden, wenn Vertretungen anliegen
```

Vorschau und Testversand:

```bash
curl http://localhost:3000/api/notify/plan/preview
curl -X POST http://localhost:3000/api/notify/test
```

Der Bot meldet sich **auch dann**, wenn nichts anliegt oder wenn die Anmeldung
klemmt. Eine ausbleibende Nachricht sähe sonst genauso aus wie „heute keine
Vertretung" – und darauf sollte man sich morgens nicht verlassen.

**Laufende Überwachung.** Die 6:45-Nachricht ist eine Momentaufnahme;
Vertretungen für den Folgetag werden oft erst nachmittags eingetragen. Deshalb
prüft ein zweiter Job den Plan regelmäßig und meldet **nur Änderungen**
gegenüber dem letzten Stand:

```
NOTIFY_PLAN_WATCH=on
NOTIFY_PLAN_WATCH_INTERVAL_MIN=15
NOTIFY_PLAN_WATCH_FROM=06:00
NOTIFY_PLAN_WATCH_TO=20:00
NOTIFY_PLAN_WATCH_DAYS=0,1,2,3,4,5,6   # auch So: Montagsplan steht oft abends
```

Zugänge stehen mit `+`, zurückgenommene Einträge mit `−`. Was **keine** Meldung
auslöst: der Tageswechsel (der heutige Tag fällt über Nacht aus dem Plan) und
der erste Lauf nach der Einrichtung. Der letzte Stand liegt in
`data/notify-state.json`, ein Neustart löst deshalb keine Nachflut aus.

**Tagesinfos** („Unterrichtsfrei", Klausuren) stehen im Portal in einer eigenen
Tabelle neben den Vertretungen und werden mitgelesen – sie verschieben den
ganzen Tag, tauchen aber in keiner Vertretungszeile auf. Ein Tag kann
gleichzeitig „keine Vertretungen" und „Unterrichtsfrei, 6 Std." melden.

**Wenn das Portal sein Markup ändert**, meldet der Abruf `state: "unknown"` statt
still eine leere Liste zu liefern. Dann `curl .../api/substitutions/raw` ansehen
und den Parser in `server/integrations/schulportal.js` nachziehen; die Tests
dazu liegen in `server/schulportal.test.js` (`npm test -w server`).

---

## Sicherheitshinweise

- Die `.env` **niemals** committen oder weitergeben (sie ist in `.gitignore`).
- App-spezifische Passwörter kannst du bei Apple jederzeit einzeln widerrufen.
- Erreichbar ist das Dashboard nur privat (LAN/Tailscale), nicht offen im
  Internet. Falls du es je öffentlich machst: vorher HTTPS + Zugangsschutz.
