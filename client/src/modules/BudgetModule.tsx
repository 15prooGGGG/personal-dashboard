import { budget } from '../data/mock.ts'
import { formatCurrency } from '../lib/format.ts'

export default function BudgetModule() {
  const balance = budget.income - budget.expenses
  return (
    <div>
      <div className="budget__summary">
        <div className="budget__stat">
          <span className="muted">Einnahmen</span>
          <span className="data up">{formatCurrency(budget.income, budget.currency)}</span>
        </div>
        <div className="budget__stat">
          <span className="muted">Ausgaben</span>
          <span className="data down">{formatCurrency(budget.expenses, budget.currency)}</span>
        </div>
        <div className="budget__stat">
          <span className="muted">Saldo</span>
          <span className={`data ${balance >= 0 ? 'up' : 'down'}`}>{formatCurrency(balance, budget.currency)}</span>
        </div>
      </div>
      <ul className="list" style={{ marginTop: '0.75rem' }}>
        {budget.recentTransactions.map((t) => (
          <li className="row" key={t.id} style={{ justifyContent: 'space-between' }}>
            <span className="row__main row__title">{t.label}</span>
            <span className={`data ${t.amount >= 0 ? 'up' : 'down'}`}>
              {t.amount >= 0 ? '+' : '−'}
              {formatCurrency(Math.abs(t.amount), budget.currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
