import { useEffect, useState } from 'react'
import PageSection from '../components/PageSection.tsx'
import { TodoIcon } from '../components/icons.tsx'
import type { Todo } from '../types.ts'

export default function TodoSection() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/todos')
      .then((r) => r.json())
      .then((d) => setTodos(d.todos ?? []))
      .catch(() => setError('Liste gerade nicht verfügbar.'))
      .finally(() => setLoading(false))
  }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setText('')
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value })
      })
      const todo = (await res.json()) as Todo
      setTodos((list) => [...list, todo])
    } catch {
      setError('Konnte nicht speichern.')
    }
  }

  async function toggle(todo: Todo) {
    const done = !todo.done
    setTodos((list) => list.map((t) => (t.id === todo.id ? { ...t, done } : t)))
    try {
      await fetch(`/api/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done })
      })
    } catch {
      setTodos((list) => list.map((t) => (t.id === todo.id ? { ...t, done: !done } : t)))
    }
  }

  async function remove(id: string) {
    setTodos((list) => list.filter((t) => t.id !== id))
    try {
      await fetch(`/api/todos/${id}`, { method: 'DELETE' })
    } catch {
      // ignorieren – nächster Reload holt den echten Stand
    }
  }

  // Offene zuerst, erledigte unten.
  const sorted = [...todos].sort((a, b) => Number(a.done) - Number(b.done))
  const openCount = todos.filter((t) => !t.done).length

  return (
    <PageSection title="To-Do" icon={TodoIcon} note={`${openCount} offen · für heute`}>
      <div className="card">
        <form className="todoadd" onSubmit={add}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Neue Aufgabe für heute …"
            maxLength={200}
            aria-label="Neue Aufgabe"
          />
          <button type="submit">Hinzufügen</button>
        </form>

        {loading ? (
          <div className="state">Lädt …</div>
        ) : error ? (
          <div className="state">{error}</div>
        ) : todos.length === 0 ? (
          <div className="state">Noch keine Aufgaben. Trag deine erste ein.</div>
        ) : (
          <ul className="list">
            {sorted.map((t) => (
              <li className="todoitem" key={t.id}>
                <button
                  className={`todocheck ${t.done ? 'is-done' : ''}`}
                  onClick={() => toggle(t)}
                  role="checkbox"
                  aria-checked={t.done}
                  aria-label={t.done ? 'Als offen markieren' : 'Als erledigt markieren'}
                >
                  {t.done && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12 5 5L20 6" />
                    </svg>
                  )}
                </button>
                <span className={`todotext ${t.done ? 'is-done' : ''}`}>{t.text}</span>
                <button className="tododel" onClick={() => remove(t.id)} aria-label="Aufgabe löschen">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="muted todohint">
          Offene Aufgaben bleiben über Nacht stehen. Erledigte werden am nächsten Tag automatisch entfernt.
        </p>
      </div>
    </PageSection>
  )
}
