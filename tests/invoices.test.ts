import {describe,it,expect} from 'vitest';
import {invoiceBalance,invoiceTotals,latestFollowup,type Invoice,type InvoicePayment,type InvoiceFollowup} from '../lib/invoices';
import {expenseBalance,type Expense} from '../lib/expenses';
const invoice={id:'one',status:'sent',total_cents:10000,currency:'EUR',due_date:'2026-09-15'} as Invoice;
const payment={invoice_id:'one',amount_cents:4000,currency:'EUR'} as InvoicePayment;
describe('invoice balances',()=>{
 it('does not invent overdue status when a historical invoice has no due date',()=>{expect(invoiceBalance({...invoice,due_date:null,status:'pending'},[],'2026-09-14').status).toBe('pending')});
 it('tracks partial receipts and overdue precedence',()=>{expect(invoiceBalance(invoice,[payment],'2026-09-15')).toEqual({received:4000,pending:6000,status:'partial'});expect(invoiceBalance(invoice,[payment],'2026-09-16').status).toBe('overdue')});
 it('settles exactly and excludes draft and cancelled totals',()=>{expect(invoiceBalance(invoice,[{...payment,amount_cents:10000}]).status).toBe('paid');expect(invoiceTotals([{...invoice,status:'draft'},{...invoice,status:'cancelled'}],[]).total).toBe(0)});
 it('allows latest followup to clear previous next action',()=>{const f=[{invoice_id:'one',followup_date:'2026-09-01',created_at:'a',next_action:'Call'},{invoice_id:'one',followup_date:'2026-09-02',created_at:'b',next_action:''}] as InvoiceFollowup[];expect(latestFollowup(invoice,f)?.next_action).toBe('')});
 it('keeps unknown expense fees distinct from zero and invoice receipt from payment',()=>{const e={id:'one',total_cents:null,status:'missing',due_date:null} as Expense;expect(expenseBalance(e,[]).pending).toBeNull();expect(expenseBalance({...e,total_cents:5000},[]).status).toBe('missing')});
});
