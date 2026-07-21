import PageSection from '../components/PageSection.tsx'
import NotConnected from '../components/NotConnected.tsx'
import { TodoIcon } from '../components/icons.tsx'
import { useApi } from '../lib/useApi.ts'
import type { Todo } from '../types.ts'

interface TodoResponse {
  configured: boolean
  tasks: Todo[]
  error?: string
}

function dueLabel(due: string | null): string {
  if (!due) return ''
  return new Date(due).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}

export default function TodoSection() {
  const { data, loading, error } = useApi<TodoResponse>('/api/todo', 2 * 60 * 1000)

  let body
  if (loading) body = <div className="state">Lädt …</div>
  else if (error) body = <div className="state">{error}</div>
  else if (!data?.configured || data.error)
    body = (
      <NotConnected
        name="Notion"
        errorDetail={data?.error}
        steps={[
          'notion.so/my-integrations → "New integration" (Internal) → Token kopieren.',
          'Deine To-Do-Datenbank öffnen → "…" → Verbindungen → Integration hinzufügen.',
          'Datenbank-ID aus der URL (32-stelliger Teil) und Token unten eintragen.'
        ]}
        envVars={['NOTION_TOKEN', 'NOTION_TODO_DATABASE_ID']}
      />
    )
  else {
    const open = data.tasks
      .filter((t) => !t.done)
      .sort((a, b) => {
        if (!a.due) return 1
        if (!b.due) return -1
        return +new Date(a.due) - +new Date(b.due)
      })
    if (open.length === 0) body = <div className="state">Alles erledigt.</div>
    else
      body = (
        <div className="card">
          <ul className="list">
            {open.map((t) => (
              <li className="todo" key={t.id}>
                <span className="todo__box" aria-hidden />
                <span className="todo__title">{t.title}</span>
                {t.due && <span className="todo__due data">{dueLabel(t.due)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )
  }

  return (
    <PageSection title="To-Do" icon={TodoIcon} note="Notion · offene Aufgaben">
      {body}
    </PageSection>
  )
}
