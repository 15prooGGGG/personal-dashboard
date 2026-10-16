#!/usr/bin/env bash
# ===========================================================================
# KI-Coach-Runner – lässt Claude über Lauris claude.ai-Abo entscheiden.
#
# Läuft per Cron alle 2 Minuten auf dem Server (NICHT im Container, denn nur
# hier ist Claude Code angemeldet). Fragt das Dashboard, ob eine Runde fällig
# ist (abends Wecker, morgens Tagesjustierung, oder Knopf auf der Startseite).
# Wenn nicht: sofort fertig, kostet nichts. Wenn ja: `claude -p` mit eigenem,
# schlankem System-Prompt (ca. 1–2k Token statt 120k Claude-Code-Unterbau),
# Antwort zurück ans Dashboard.
#
# Kosten: keine extra. Abgerechnet wird nichts – die Läufe zählen nur gegen
# das Nutzungslimit des Claude-Abos, wie jede andere Claude-Code-Nutzung.
# Ein API-Key wird bewusst entfernt, damit nie die bezahlte API greift.
#
# Von Hand:   scripts/ai-coach-runner.sh            (nur wenn fällig)
#             scripts/ai-coach-runner.sh evening    (Runde erzwingen)
# Cron:       */2 * * * * <pfad>/scripts/ai-coach-runner.sh >> <pfad>/data/ai-coach-runner.log 2>&1
# ===========================================================================
set -euo pipefail

export PATH="$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin"
# Nie über die bezahlte API: ohne diese Variablen nutzt claude die claude.ai-Anmeldung.
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN ANTHROPIC_BASE_URL

BASE="${DASHBOARD_URL:-http://127.0.0.1:3000}"
MODEL="${AI_COACH_MODEL:-sonnet}"
STATE="${XDG_STATE_HOME:-$HOME/.local/state}/ai-coach"
mkdir -p "$STATE"

# Nur ein Lauf gleichzeitig.
exec 9>"$STATE/lock"
flock -n 9 || exit 0

# Nach einem Fehler 30 min Pause, statt alle 2 min erneut zu scheitern.
if [[ -z "${1:-}" && -f "$STATE/failed" ]] && (( $(date +%s) - $(stat -c %Y "$STATE/failed") < 1800 )); then
  exit 0
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK" # leerer Ordner: keine CLAUDE.md, kein Projektkontext

curl -fsS --max-time 60 "$BASE/api/dayplan/ai/job${1:+?mode=$1}" > job.json
MODE="$(python3 -c 'import json,sys; print(json.load(open("job.json")).get("due") or "")')"
[[ -z "$MODE" ]] && exit 0

python3 - <<'PY'
import json
job = json.load(open("job.json"))
open("system.txt", "w").write(job["system"])
open("prompt.txt", "w").write(job["prompt"])
open("schema.json", "w").write(json.dumps(job["schema"]))
PY

echo "$(date -Is) Runde: $MODE"
if ! claude -p "$(cat prompt.txt)" \
  --system-prompt "$(cat system.txt)" \
  --json-schema "$(cat schema.json)" \
  --output-format json \
  --model "$MODEL" \
  --tools "" \
  --strict-mcp-config \
  --setting-sources "" \
  --disable-slash-commands \
  --exclude-dynamic-system-prompt-sections \
  --no-session-persistence > out.json; then
  echo "$(date -Is) claude fehlgeschlagen: $(head -c 300 out.json)"
  touch "$STATE/failed"
  exit 1
fi

python3 - "$MODEL" <<'PY' > result.json || true
import json, sys
out = json.load(open("out.json"))
if out.get("is_error") or not out.get("structured_output"):
    sys.stderr.write("Keine gültige Antwort: %s\n" % str(out.get("result"))[:300])
    sys.exit(1)
model = next(iter(out.get("modelUsage", {})), sys.argv[1])
print(json.dumps({"advice": out["structured_output"], "model": model}))
PY
[[ -s result.json ]] || { touch "$STATE/failed"; exit 1; }

curl -fsS --max-time 60 -H 'Content-Type: application/json' --data @result.json \
  "$BASE/api/dayplan/ai/result?mode=$MODE" > /dev/null
rm -f "$STATE/failed"
echo "$(date -Is) Runde $MODE gespeichert"
