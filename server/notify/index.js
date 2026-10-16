// ===========================================================================
// Registriert die Push-Jobs. Ohne eingerichtetes Signal passiert hier nichts –
// der Rest des Dashboards läuft davon unberührt weiter.
// ===========================================================================
import { config } from '../config.js'
import { sendSignal, drainSignal, isConfigured as signalReady } from '../integrations/signal.js'
import { isConfigured as schulportalReady } from '../integrations/schulportal.js'
import { daily, every, startScheduler, listJobs, berlinNow } from './scheduler.js'
import { buildPlanMessage, buildPlanMessageIfRelevant } from './plan.js'
import { checkForChanges, watchWindow } from './plan-watch.js'
import { buildDigest } from './market.js'
import { isConfigured as aiReady, loadAdvice } from '../ai-coach.js'
import { runAiCoach } from '../day-plan-context.js'
import { fetchWhoopHistory } from '../integrations/whoop.js'

export { listJobs }

const parseDays = (raw) => {
  const days = raw
    .split(',')
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  return days.length ? days : [1, 2, 3, 4, 5]
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

// Kurzfassung der KI-Einschätzung für Signal.
export function aiMessage(entry) {
  const head = entry.mode === 'evening' ? `🌙 Morgen: ${entry.wake ? `Wecker ${entry.wake}` : 'kein Wecker nötig'}` : '☀️ Heute'
  return [`${head} – ${entry.headline}`, entry.reasoning, ...entry.actions.map((a) => `• ${a}`)].join('\n')
}

// KI-Coach: abends Wecker für morgen, morgens Tagesjustierung, sobald WHOOP
// die Nacht gewertet hat. Läuft auch ohne Signal (Ergebnis im Dashboard).
function setupAiCoach() {
  if (!aiReady()) {
    console.log('ANTHROPIC_API_KEY fehlt – KI-Coach aus, Tagesplan nutzt die Regeln.')
    return
  }
  const push = async (entry) => {
    if (signalReady() && config.ai.signal) await sendSignal(aiMessage(entry))
  }
  daily({
    name: 'ai-evening',
    at: config.ai.eveningTime,
    days: ALL_DAYS,
    grace: 180,
    run: async () => push(await runAiCoach('evening'))
  })
  every({
    name: 'ai-morning',
    minutes: 15,
    from: '05:00',
    to: '12:00',
    days: ALL_DAYS,
    run: async () => {
      const today = berlinNow().date
      if (loadAdvice().morning?.forDate === today) return
      // Erst wenn WHOOP die Nacht gewertet hat (Recovery da, aufgewacht heute).
      const history = await fetchWhoopHistory()
      const d = history?.days?.[0]
      const wokeToday = d?.sleep?.wake && berlinNow(new Date(d.sleep.wake)).date === today
      if (!d?.recovery || !wokeToday) return
      await push(await runAiCoach('morning'))
    }
  })
}

export function setupNotifications() {
  setupAiCoach()
  if (!signalReady()) {
    console.log('Signal nicht eingerichtet – keine Push-Nachrichten aktiv.')
    startScheduler()
    return
  }

  // Warteschlange regelmäßig leeren, damit die Kopplung bestehen bleibt.
  // Läuft rund um die Uhr und unabhängig von allen anderen Schaltern – ohne
  // das nützt der beste Job nichts, weil irgendwann nichts mehr rausgeht.
  every({
    name: 'signal-receive',
    minutes: 30,
    days: [0, 1, 2, 3, 4, 5, 6],
    run: drainSignal
  })

  if (config.notify.plan && schulportalReady()) {
    daily({
      name: 'plan',
      at: config.notify.planTime,
      days: parseDays(config.notify.planDays),
      run: async () => {
        const message = await buildPlanMessageIfRelevant()
        if (message) await sendSignal(message)
      }
    })
  }

  // Die Morgennachricht ist eine Momentaufnahme, Vertretungen werden aber den
  // ganzen Tag eingetragen – deshalb zusätzlich die laufende Überwachung.
  if (config.notify.planWatch && schulportalReady()) {
    const window = watchWindow()
    every({
      name: 'plan-watch',
      minutes: window.minutes,
      from: window.from,
      to: window.to,
      days: parseDays(window.days),
      run: async () => {
        const message = await checkForChanges()
        if (message) await sendSignal(message)
      }
    })
  }

  startScheduler()
}

// Testversand aus dem Dashboard heraus – damit du die Einrichtung prüfen
// kannst, ohne bis 6:45 zu warten.
export async function sendTestPlan() {
  return sendSignal(await buildPlanMessage())
}

// Testversand des Morgen-Briefings (Kurse/Watchlist), analog zu sendTestPlan.
export async function sendTestDigest() {
  return sendSignal(await buildDigest())
}
