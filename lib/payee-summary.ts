import type {BankData} from './bank';
import {bankAllocated} from './bank';
import {expenseBalance} from './expenses';

/** A transfer is evidence of payment, not an additional expense or a net salary. */
export function payeeSummary(data: BankData, kind: 'artist' | 'supplier', id: string) {
  const expenses = data.expenses.filter(e => e.status !== 'cancelled' &&
    (kind === 'artist' ? e.talent_id === id : e.supplier_id === id&&!e.covered_by_expense_id));
  const movements = data.movements.filter(m =>
    kind === 'artist' ? m.talent_id === id : m.supplier_id === id);
  const currencies = [...new Set([...expenses.map(e => e.currency), ...movements.map(m => m.currency)])].sort();
  const totals = currencies.map(currency => {
    const rows = expenses.filter(e => e.currency === currency);
    const bank = movements.filter(m => m.currency === currency);
    return {
      currency,
      total: rows.reduce((n,e) => n + (e.total_cents ?? 0), 0),
      paid: rows.reduce((n,e) => n + expenseBalance(e,data.payments).paid, 0),
      pending: rows.reduce((n,e) => n + (expenseBalance(e,data.payments).pending ?? 0), 0),
      bank: bank.reduce((n,m) => n + m.amount_cents, 0),
      unallocated: bank.reduce((n,m) => n + m.amount_cents - bankAllocated(m,data.payments), 0),
    };
  });
  return {expenses, movements, totals, unknown: expenses.filter(e => e.total_cents === null).length,
    review: movements.filter(m => m.status !== 'reconciled').length};
}
