import {expect,it} from 'vitest';
import {inventoryFinance} from '../lib/inventory-finance';
it('excludes cancelled revenue and preserves a confirmed zero repair cost',()=>{
  const result=inventoryFinance([{status:'RETURNED',rental_revenue:20000},{status:'CANCELLED',rental_revenue:90000}],[{actual_cost:0,estimated_cost:10000}],5000);
  expect(result).toMatchObject({revenue:20000,actualRepairCost:0,estimatedRepairCost:0,balance:15000});
});
it('does not present unknown amounts or repair estimates as an established margin',()=>{
  expect(inventoryFinance([{status:'RESERVED',rental_revenue:null}],[],0).balance).toBeNull();
  expect(inventoryFinance([{status:'RETURNED',rental_revenue:20000}],[{actual_cost:null,estimated_cost:10000}],5000)).toMatchObject({balance:null,actualRepairCost:0,estimatedRepairCost:10000});
  expect(inventoryFinance([],[],null).balance).toBeNull();
});
