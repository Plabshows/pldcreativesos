export type CollectionSource={number:string;total_cents:number;collection_date:string|null;issue_date:string;notes:string};
export type CollectionReceipt={date:string;amount:number;note:string};
const cents=(s:string)=>Math.round(Number(s.replace(/\s/g,'').replace(/,(?=\d{3}(?:\D|$))/g,'').replace(',','.'))*100);
function localDate(value:string,year:string){const [d,m]=value.split(/[/-]/);const result=`${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;if(!Number.isFinite(Date.parse(result))||new Date(result).toISOString().slice(0,10)!==result)throw Error('Fecha de cobro no válida');return result}
/** FECHA COBRO records settlement of this invoice, not settlement of the entire booking. */
export function collectionReceiptPlan(row:CollectionSource):CollectionReceipt[]{
 const year=row.issue_date.slice(0,4),notes=row.notes;
 const split=notes.match(/([\d,.]+)\s*€\s*(\d{1,2}[/-]\d{1,2})\s*-\s*([\d,.]+)\s*€\s*(\d{1,2}[/-]\d{1,2})/i);
 const deposit=notes.match(/50%\s*-\s*([\d,.]+)\s*€.*RESTO\s*([\d,.]+)\s*€\s*COBRADO\s*(\d{1,2}[/-]\d{1,2})/i);
 const advance=notes.match(/([\d,.]+)\s*€\s*a\s*cta\.?\s*(\d{1,2}[/-]\d{1,2})/i);
 const partial=notes.match(/^\s*([\d,.]+)\s*€\s*(\d{1,2}[/-]\d{1,2})\s*$/i);
 let receipts:CollectionReceipt[]=[];
 if(split)receipts=[{date:localDate(split[2],year),amount:cents(split[1]),note:'Primer cobro indicado en notas'},{date:localDate(split[4],year),amount:cents(split[3]),note:'Segundo cobro indicado en notas'}];
 else if(deposit&&row.collection_date)receipts=[{date:row.collection_date,amount:cents(deposit[1]),note:'Anticipo indicado en notas'},{date:localDate(deposit[3],year),amount:cents(deposit[2]),note:'Resto cobrado indicado en notas'}];
 else if(advance&&row.collection_date)receipts=[{date:localDate(advance[2],year),amount:cents(advance[1]),note:'Anticipo indicado en notas'},{date:row.collection_date,amount:row.total_cents-cents(advance[1]),note:'Saldo cobrado según FECHA COBRO'}];
 else if(partial)receipts=[{date:localDate(partial[2],year),amount:cents(partial[1]),note:'Cobro parcial indicado en notas; sin fecha de liquidación total'}];
 else if(row.collection_date)receipts=[{date:row.collection_date,amount:row.total_cents,note:'Cobro de esta factura según FECHA COBRO del Excel'}];
 if(receipts.some(p=>!Number.isSafeInteger(p.amount)||p.amount<=0)||receipts.reduce((n,p)=>n+p.amount,0)>row.total_cents)throw Error('Los cobros indicados superan el importe de la factura o no son válidos');
 if((split||deposit||advance)&&receipts.length&&receipts.reduce((n,p)=>n+p.amount,0)!==row.total_cents)throw Error('Los plazos no cuadran con el total de la factura');
 return receipts;
}
