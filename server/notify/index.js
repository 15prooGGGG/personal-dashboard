// ===========================================================================
// Registriert die Push-Jobs. Ohne eingerichtetes Signal passiert hier nichts –
// der Rest des Dashboards läuft davon unberührt weiter.
// ===========================================================================
import { config } from '../config.js'
import { sendSignal, drainSignal, isConfigured as signalReady } from '../integrations/signal.js'
import { isConfigured as schulportalReady } from '../integrations/schulportal.js'
import { daily, every, startScheduler, listJobs } from './scheduler.js'
import { buildPlanMessage, buildPlanMessageIfRelevant } from './plan.js'
import { checkForChanges, watchWindow } from './plan-watch.js'

export { listJobs }

const parseDays = (raw) => {
  const days = raw
    .split(',')
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  return days.length ? days : [1, 2, 3, 4, 5]
}

export function setupNotifications() {
  if (!signalReady()) {
    console.log('Signal nicht eingerichtet – keine Push-Nachrichten aktiv.')
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
