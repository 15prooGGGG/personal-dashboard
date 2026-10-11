// Einmalige WHOOP-Kopplung (auf dem Server ausführen: node scripts/whoop-connect.js).
// 1. Link öffnen und bei WHOOP anmelden/zustimmen.
// 2. Der Browser landet auf https://localhost/… und zeigt einen Fehler – das
//    ist gewollt. Die komplette Adresse aus der Browserzeile hier einfügen.
// Die Tokens landen in data/whoop-tokens.json; das Dashboard übernimmt ab da.
import crypto from 'node:crypto'
import readline from 'node:readline/promises'
import { config } from '../server/config.js'
import { AUTH_URL, SCOPES, exchangeCode, isConfigured } from '../server/integrations/whoop.js'

if (!isConfigured()) {
  console.error('WHOOP_CLIENT_ID und WHOOP_CLIENT_SECRET fehlen in der .env.')
  process.exit(1)
}

// WHOOP verlangt einen state mit mindestens 8 Zeichen.
const state = crypto.randomBytes(12).toString('hex')
const url = new URL(AUTH_URL)
url.search = new URLSearchParams({
  response_type: 'code',
  client_id: config.whoop.clientId,
  redirect_uri: config.whoop.redirectUri,
  scope: SCOPES,
  state
})

console.log('\n1) Diesen Link öffnen und WHOOP zustimmen:\n')
console.log(url.toString())
console.log('\n2) Danach die komplette Adresse aus der Browserzeile einfügen.\n')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const pasted = (await rl.question('Adresse: ')).trim()
rl.close()

let params
try {
  params = new URL(pasted).searchParams
} catch {
  console.error('Das war keine vollständige Adresse.')
  process.exit(1)
}
if (params.get('error')) {
  console.error(`WHOOP meldet: ${params.get('error')} ${params.get('error_description') || ''}`)
  process.exit(1)
}
if (params.get('state') !== state) {
  console.error('state passt nicht – bitte den Link aus DIESEM Lauf benutzen.')
  process.exit(1)
}

await exchangeCode(params.get('code'))
console.log('\nGekoppelt. Das Dashboard zeigt die WHOOP-Werte innerhalb von ~10 Minuten.')
