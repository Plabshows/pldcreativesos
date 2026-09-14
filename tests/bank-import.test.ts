import {it,expect} from 'vitest';
import {parseBankCsv,bankImportAmount} from '../lib/bank-import';
import {findSupplierAlias} from '../lib/bank';
it('resolves provider aliases to the existing entity without merging similar names',()=>{const suppliers=[{id:'fed',name:'FEDRIANI EVENT SL',aliases:['Fedriani','Fedriani Event']}];expect(findSupplierAlias(suppliers,'fedriani event s.l.')?.id).toBe('fed');expect(findSupplierAlias(suppliers,'Fedriani')?.id).toBe('fed');expect(findSupplierAlias(suppliers,'Another Fedriani')).toBeUndefined()});
it('reads Spanish amounts exactly, validates real dates and keeps duplicate bank rows',()=>{
 expect(bankImportAmount('2.642,89 €')).toBe(264289);expect(bankImportAmount('114')).toBe(11400);expect(()=>bankImportAmount('2184.2073')).toThrow();expect(()=>bankImportAmount('-10')).toThrow();
 const rows=parseBankCsv('fecha;referencia;concepto;importe\n03/08/2026;2026-2149;Transferencia;895,15\n03/08/2026;2026-2149;Transferencia;895,15');expect(rows).toHaveLength(2);expect(rows[0].payment_date).toBe('2026-08-03');expect(rows[0].amount_cents).toBe(89515);
 expect(()=>parseBankCsv('fecha,referencia,concepto,importe\n2026-02-30,R,Transfer,10')).toThrow(/Fila 2/);
});
