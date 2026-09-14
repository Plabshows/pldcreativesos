import {expect,it} from 'vitest';
import {payeeSummary} from '../lib/payee-summary';
import type {BankData} from '../lib/bank';

it('keeps currencies separate and counts transfers only as evidence, including unknown totals',()=>{
 const data={expenses:[
  {id:'eur',talent_id:'a',supplier_id:'s',currency:'EUR',total_cents:10000,status:'pending'},
  {id:'usd',talent_id:'a',supplier_id:'s',currency:'USD',total_cents:20000,status:'pending'},
  {id:'unknown',talent_id:'a',supplier_id:null,currency:'EUR',total_cents:null,status:'missing'},
  {id:'cancelled',talent_id:'a',supplier_id:'s',currency:'EUR',total_cents:99999,status:'cancelled'},
 ],payments:[
  {expense_id:'eur',amount_cents:4000,bank_movement_id:'bank'},
  {expense_id:'eur',amount_cents:1000,bank_movement_id:null},
  {expense_id:'usd',amount_cents:5000,bank_movement_id:'usd-bank'},
 ],movements:[
  {id:'bank',talent_id:'a',supplier_id:'s',currency:'EUR',amount_cents:7000,status:'review'},
  {id:'usd-bank',talent_id:'a',supplier_id:'s',currency:'USD',amount_cents:5000,status:'reconciled'},
  {id:'other',talent_id:'b',supplier_id:'other',currency:'EUR',amount_cents:99999,status:'review'},
 ]} as unknown as BankData;
 const artist=payeeSummary(data,'artist','a');
 expect(artist.totals).toEqual([
  {currency:'EUR',total:10000,paid:5000,pending:5000,bank:7000,unallocated:3000},
  {currency:'USD',total:20000,paid:5000,pending:15000,bank:5000,unallocated:0},
 ]);
 expect(artist.unknown).toBe(1);expect(artist.review).toBe(1);
 const supplier=payeeSummary(data,'supplier','s');
 expect(supplier.unknown).toBe(0);expect(supplier.totals).toEqual(artist.totals);
 expect(payeeSummary(data,'artist','missing').totals).toEqual([]);
});
