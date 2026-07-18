import { budget } from '../data/mock.ts'

const fmt = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: budget.currency }).format(v)

// Experimentelles Modul – bewusst schlicht gehalten.
export default function BudgetModule() {
  const balance = budget.income - budget.expenses
  return (
    <div className="budget">
      <div className="budget__summary">
        <div className="budget__stat">
          <span className="muted">Einnahmen</span>
          <span className="data is-up">{fmt(budget.income)}</span>
        </div>
        <div className="budget__stat">
          <span className="muted">Ausgaben</span>
          <span className="data is-down">{fmt(budget.expenses)}</span>
        </div>
        <div className="budget__stat">
          <span className="muted">Saldo</span>
          <span className={`data ${balance >= 0 ? 'is-up' : 'is-down'}`}>{fmt(balance)}</span>
        </div>
      </div>
      <ul className="list budget__tx">
        {budget.recentTransactions.map((t) => (
          <li className="row" key={t.id}>
            <span className="row__main row__title">{t.label}</span>
            <span className={`data ${t.amount >= 0 ? 'is-up' : 'is-down'}`}>
              {t.amount >= 0 ? '+' : '−'}
              {fmt(Math.abs(t.amount)).replace('-', '')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
