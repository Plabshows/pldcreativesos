import {it,expect} from 'vitest';
import {identityMatch,resolveIdentity,validIban} from '../lib/identity';
import {expenseTotals,type Expense} from '../lib/expenses';
it('requires identity evidence beyond similar names and exposes conflicting IDs',()=>{
 expect(identityMatch({id:'a',real_name:'Africa'},{id:'b',real_name:'África Bataller'}).confidence).toBe('medium');
 expect(identityMatch({id:'a',real_name:'Mariela Marina',email:'same@example.es',tax_id:'Y7130155P'},{id:'b',real_name:'Mariela Marina Reigemborn',email:'same@example.es',tax_id:'Z4542386Y'})).toMatchObject({confidence:'medium',conflict:true});
 expect(identityMatch({id:'a',real_name:'África Bataller',email:'a@example.es'},{id:'b',real_name:'AFRICA BATALLER',email:'A@EXAMPLE.ES'}).confidence).toBe('high');
 expect(identityMatch({id:'a',real_name:'Ana',iban:'ES123'},{id:'b',real_name:'Eva',iban:'ES123'}).confidence).toBe('medium');
 expect(identityMatch({id:'a',real_name:'Miguel García',tax_id:'48794395X'},{id:'b',real_name:'África Bataller',tax_id:'07261175Y'}).confidence).toBe('low');
 expect(identityMatch({id:'a',real_name:'Luciano'},{id:'b',real_name:'Lucía Gil Blázquez'}).confidence).toBe('low');
 expect(identityMatch({id:'a',real_name:'Samu'},{id:'b',real_name:'Samuel Marti'}).confidence).toBe('medium');
});
it('reuses aliases, excludes archived merged records and exposes ambiguous names',()=>{
 const people=[{id:'a',real_name:'Omar Fraile',aliases:['Wiki','Omar']},{id:'old',real_name:'WIKI',deleted_at:'2026-01-01',merged_into:'a'}];
 expect(resolveIdentity(people,'wíki').exact?.id).toBe('a');
 expect(resolveIdentity([{id:'a',real_name:'Sofia'},{id:'b',real_name:'SOFIA'}],'Sofía')).toMatchObject({exact:null});
});
it('validates IBANs and counts a shared invoice once in the financial ledger',()=>{
 expect(validIban('ES34 0049 5055 9528 1648 7240')).toBe('ES3400495055952816487240');
 expect(validIban('ES00 0049 5055 9528 1648 7240')).toBeNull();
 const invoice={id:'i',total_cents:10000,status:'pending'} as Expense,fee={id:'f',total_cents:5000,status:'missing',covered_by_expense_id:'i'} as Expense;
 expect(expenseTotals([invoice,fee],[]).total).toBe(10000);
 expect(expenseTotals([fee],[],true).total).toBe(5000);
});
