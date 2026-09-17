import {it,expect} from 'vitest';
import {collectionReceiptPlan,type CollectionSource} from '../lib/collection-import';
const row:CollectionSource={number:'002',total_cents:159000,collection_date:'2026-05-11',issue_date:'2026-05-23',notes:''};
it('imports the explicit collection dates and splits without counting the booking twice',()=>{
 expect(collectionReceiptPlan({...row,notes:' (50% - 800 €) RESTO 790 € COBRADO 25-5'}).map(p=>[p.date,p.amount])).toEqual([['2026-05-11',80000],['2026-05-25',79000]]);
 expect(collectionReceiptPlan({...row,total_cents:1411920,collection_date:'2026-08-14',notes:'7000 € a cta. 11/8'}).map(p=>[p.date,p.amount])).toEqual([['2026-08-11',700000],['2026-08-14',711920]]);
 expect(collectionReceiptPlan({...row,total_cents:636000,collection_date:'2026-09-09',notes:'3,000 € 26/8 - 3360 € 9/9'}).map(p=>[p.date,p.amount])).toEqual([['2026-08-26',300000],['2026-09-09',336000]]);
});
it('keeps an explicitly partial receipt partial and does not halve an advance invoice again',()=>{
 expect(collectionReceiptPlan({...row,total_cents:1628727,collection_date:null,notes:'8143,64 € 3/9'}).map(p=>p.amount)).toEqual([814364]);
 expect(collectionReceiptPlan({...row,total_cents:108650,collection_date:'2026-07-15',notes:'A CTA. 50%'}).map(p=>p.amount)).toEqual([108650]);
 expect(collectionReceiptPlan({...row,collection_date:null,notes:''})).toEqual([]);
 expect(()=>collectionReceiptPlan({...row,notes:' (50% - 800 €) RESTO 900 € COBRADO 25-5'})).toThrow();
 expect(()=>collectionReceiptPlan({...row,notes:'10 € 31/2'})).toThrow();
});
