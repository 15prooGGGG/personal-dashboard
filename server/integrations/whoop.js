// ===========================================================================
// WHOOP – Recovery, Strain und Schlaf über die offizielle API (v2, OAuth 2.0).
//
// Einmalige Kopplung per `node scripts/whoop-connect.js` (siehe CONNECT.md).
// Danach hält der Server die Verbindung selbst: Der Access-Token läuft nach
// ~1 h ab und wird mit dem Refresh-Token erneuert. WHOOP rotiert dabei den
// Refresh-Token – der neue wird sofort gespeichert, sonst ist die Kopplung weg.
// Tokens liegen in data/whoop-tokens.json (gitignored), Client-Secret in .env.
// ===========================================================================
import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../../data')
const TOKEN_FILE = path.join(DATA_DIR, 'whoop-tokens.json')

const API = 'https://api.prod.whoop.com/developer'
export const AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth'
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
// "offline" liefert den Refresh-Token – ohne ihn müsste man stündlich neu koppeln.
export const SCOPES = 'offline read:recovery read:cycles read:sleep read:workout read:profile'

const TTL = 10 * 60 * 1000
let cache = null
let refreshing = null

export const isConfigured = () => Boolean(config.whoop.clientId && config.whoop.clientSecret)

function loadTokens() {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'))
  } catch {
    return null
  }
}

function saveTokens(t) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const data = {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    // 60 s Puffer, damit kein Token mitten in einer Anfrage abläuft.
    expires_at: Date.now() + (Number(t.expires_in) || 3600) * 1000 - 60 * 1000
  }
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), { mode: 0o600 })
  return data
}

async function tokenRequest(params) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.whoop.clientId,
      client_secret: config.whoop.clientSecret,
      ...params
    })
  })
  if (!res.ok) throw new Error(`WHOOP-Token ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

// Code aus dem Redirect gegen Tokens tauschen (einmalig, beim Koppeln).
export async function exchangeCode(code) {
  const t = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.whoop.redirectUri
  })
  cache = null
  return saveTokens(t)
}

async function accessToken() {
  const t = loadTokens()
  if (!t) return null
  if (Date.now() < t.expires_at) return t.access_token
  // Parallele Anfragen teilen sich einen Refresh – zwei Refreshes mit
  // demselben (rotierenden) Token würden die Kopplung zerstören.
  refreshing ??= tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: t.refresh_token,
    scope: 'offline'
  })
    .then(saveTokens)
    .finally(() => {
      refreshing = null
    })
  return (await refreshing).access_token
}

async function get(pathname, token) {
  const res = await fetch(API + pathname, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = new Error(`WHOOP ${pathname} ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

// Alle Einträge ab `start` (WHOOP liefert max. 25 pro Seite).
async function getAll(pathname, token, start) {
  const out = []
  let next = null
  for (let page = 0; page < 4; page++) {
    const q = new URLSearchParams({ limit: '25', start })
    if (next) q.set('nextToken', next)
    const j = await get(`${pathname}?${q}`, token)
    out.push(...(j.records || []))
    next = j.next_token
    if (!next) break
  }
  return out
}

// Kopplung aus dem Dashboard heraus: Link erzeugen, später die Adresse der
// (absichtlich fehlschlagenden) Redirect-Seite entgegennehmen. Der state
// verhindert, dass ein fremder oder veralteter Code angenommen wird.
const pendingStates = new Map()

export function authLink() {
  const state = crypto.randomBytes(12).toString('hex')
  pendingStates.set(state, Date.now())
  for (const [k, ts] of pendingStates) if (Date.now() - ts > 30 * 60 * 1000) pendingStates.delete(k)
  const url = new URL(AUTH_URL)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.whoop.clientId,
    redirect_uri: config.whoop.redirectUri,
    scope: SCOPES,
    state
  })
  return url.toString()
}

export async function completeLink(pasted) {
  let params
  try {
    params = new URL(String(pasted).trim()).searchParams
  } catch {
    throw new Error('Das ist keine vollständige Adresse.')
  }
  if (params.get('error')) throw new Error(`WHOOP meldet: ${params.get('error_description') || params.get('error')}`)
  const state = params.get('state')
  if (!state || !pendingStates.has(state)) {
    throw new Error('Link abgelaufen oder aus einem anderen Versuch – bitte neu auf „Mit WHOOP verbinden“ tippen.')
  }
  if (!params.get('code')) throw new Error('In der Adresse fehlt der Code.')
  pendingStates.delete(state)
  await exchangeCode(params.get('code'))
  historyCache = null
}

export async function fetchWhoop() {
  if (!isConfigured()) return { configured: false, connected: false }
  if (cache && Date.now() - cache.ts < TTL) return cache.value

  const token = await accessToken()
  if (!token) return { configured: true, connected: false }

  const [recoveries, cycles, sleeps] = await Promise.all([
    get('/v2/recovery?limit=1', token),
    get('/v2/cycle?limit=1', token),
    // Nickerchen überspringen – gezeigt wird die Hauptnacht.
    get('/v2/activity/sleep?limit=5', token)
  ])

  const rec = recoveries.records?.[0]
  const cyc = cycles.records?.[0]
  const slp = (sleeps.records || []).find((s) => !s.nap)
  const scored = (r) => r?.score_state === 'SCORED' && r.score

  const stages = scored(slp)?.stage_summary
  const value = {
    configured: true,
    connected: true,
    recovery: scored(rec)
      ? {
          score: rec.score.recovery_score,
          hrv: rec.score.hrv_rmssd_milli,
          restingHr: rec.score.resting_heart_rate
        }
      : null,
    // Strain des laufenden Tages (wächst über den Tag).
    strain: scored(cyc) ? cyc.score.strain : null,
    sleep: scored(slp)
      ? {
          performance: slp.score.sleep_performance_percentage,
          durationMs: stages
            ? stages.total_light_sleep_time_milli +
              stages.total_slow_wave_sleep_time_milli +
              stages.total_rem_sleep_time_milli
            : null
        }
      : null,
    updatedAt: new Date().toISOString()
  }
  cache = { value, ts: Date.now() }
  return value
}

// ---------------------------------------------------------------------------
// Verlauf für den Schlaf-Tab: eine Zeile je WHOOP-Zyklus (= Schlaf + der Tag
// danach), neueste zuerst. Der Zyklus beginnt mit dem Einschlafen, daher
// gehören Schlaf, Recovery und Strain/Trainings desselben Zyklus zusammen.
// ---------------------------------------------------------------------------
const HISTORY_DAYS = 31
let historyCache = null

export async function fetchWhoopHistory() {
  if (!isConfigured()) return { configured: false, connected: false }
  if (historyCache && Date.now() - historyCache.ts < TTL) return historyCache.value

  const token = await accessToken()
  if (!token) return { configured: true, connected: false }

  const start = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString()
  const [cycles, sleeps, recoveries, workoutsRes] = await Promise.all([
    getAll('/v2/cycle', token, start),
    getAll('/v2/activity/sleep', token, start),
    getAll('/v2/recovery', token, start),
    // Ältere Kopplungen haben read:workout noch nicht – dann ohne Trainings.
    getAll('/v2/activity/workout', token, start).catch((err) => {
      if (err.status === 401 || err.status === 403) return null
      throw err
    })
  ])

  const sleepByCycle = new Map()
  const naps = []
  for (const s of sleeps) {
    if (s.nap) naps.push(s)
    else if (!sleepByCycle.has(s.cycle_id)) sleepByCycle.set(s.cycle_id, s)
  }
  const recByCycle = new Map(recoveries.map((r) => [r.cycle_id, r]))
  const workouts = (workoutsRes || [])
    .filter((w) => w.score_state === 'SCORED')
    .map((w) => ({
      sport: w.sport_name || 'Training',
      start: w.start,
      end: w.end,
      strain: w.score?.strain ?? null,
      avgHr: w.score?.average_heart_rate ?? null,
      maxHr: w.score?.max_heart_rate ?? null
    }))

  const days = cycles.map((c) => {
    const s = sleepByCycle.get(c.id)
    const r = recByCycle.get(c.id)
    const ss = s?.score_state === 'SCORED' ? s.score : null
    const st = ss?.stage_summary
    const need = ss?.sleep_needed
    const rs = r?.score_state === 'SCORED' ? r.score : null
    const cEnd = c.end ? new Date(c.end).getTime() : Date.now()
    const inCycle = (iso) => {
      const t = new Date(iso).getTime()
      return t >= new Date(c.start).getTime() && t < cEnd
    }
    return {
      cycleId: c.id,
      start: c.start,
      end: c.end,
      sleep: ss
        ? {
            bedtime: s.start,
            wake: s.end,
            durationMs: st.total_light_sleep_time_milli + st.total_slow_wave_sleep_time_milli + st.total_rem_sleep_time_milli,
            inBedMs: st.total_in_bed_time_milli,
            awakeMs: st.total_awake_time_milli,
            lightMs: st.total_light_sleep_time_milli,
            deepMs: st.total_slow_wave_sleep_time_milli,
            remMs: st.total_rem_sleep_time_milli,
            cycles: st.sleep_cycle_count,
            disturbances: st.disturbance_count,
            performance: ss.sleep_performance_percentage ?? null,
            efficiency: ss.sleep_efficiency_percentage ?? null,
            consistency: ss.sleep_consistency_percentage ?? null,
            respiratoryRate: ss.respiratory_rate ?? null,
            need: need
              ? {
                  baselineMs: need.baseline_milli,
                  debtMs: need.need_from_sleep_debt_milli,
                  strainMs: need.need_from_recent_strain_milli,
                  napMs: need.need_from_recent_nap_milli
                }
              : null
          }
        : null,
      recovery: rs
        ? {
            score: rs.recovery_score,
            hrv: rs.hrv_rmssd_milli,
            restingHr: rs.resting_heart_rate,
            spo2: rs.spo2_percentage ?? null,
            skinTemp: rs.skin_temp_celsius ?? null
          }
        : null,
      strain: c.score_state === 'SCORED' ? c.score.strain : null,
      steps: c.step_count ?? null,
      workouts: workouts.filter((w) => inCycle(w.start)),
      naps: naps
        .filter((n) => inCycle(n.start))
        .map((n) => ({ start: n.start, end: n.end }))
    }
  })

  const value = {
    configured: true,
    connected: true,
    workoutsAvailable: workoutsRes !== null,
    days,
    updatedAt: new Date().toISOString()
  }
  historyCache = { value, ts: Date.now() }
  return value
}
