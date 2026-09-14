import Papa from 'papaparse';
export function bankImportAmount(value:string){
 let s=value.trim().replace(/[€\s]/g,'');
 if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
 if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Los gastos deben tener un importe positivo, con un máximo de dos decimales.');
 const [whole,decimal='']=s.split('.'),cents=Number(whole)*100+Number(decimal.padEnd(2,'0'));
 if(!Number.isSafeInteger(cents)||cents<=0||cents>100000000000)throw Error('Importe fuera de rango.');return cents;
}
export function parseBankCsv(text:string){
 const result=Papa.parse<string[]>(text.replace(/^\uFEFF/,''),{skipEmptyLines:'greedy'});
 if(result.errors.length)throw Error('No se pudo leer el CSV. Revisa sus separadores y comillas.');
 const [header,...rows]=result.data,normalize=(s:string)=>s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(!header||!rows.length||rows.length>1000)throw Error('El CSV debe contener entre 1 y 1.000 gastos.');
 const keys=header.map(normalize),positions=['fecha','referencia','concepto','importe'].map(k=>keys.indexOf(k));
 if(positions.some(p=>p<0))throw Error('Usa las columnas: fecha, referencia, concepto, importe.');
 return rows.map((r,i)=>{try{if(r.length!==header.length)throw Error('Número de columnas incorrecto.');const [date,reference,concept,amount]=positions.map(p=>(r[p]||'').trim());
 const iso=date.includes('/')?date.split('/').reverse().map((s,j)=>j===0?s:s.padStart(2,'0')).join('-'):date;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||!Number.isFinite(Date.parse(iso))||new Date(iso).toISOString().slice(0,10)!==iso)throw Error('Fecha no válida.');
 if(!concept||concept.length>10000||reference.length>500)throw Error('Concepto o referencia no válidos.');
 return {payment_date:iso,original_reference:reference,original_concept:concept,amount_cents:bankImportAmount(amount),source_row:i+2,source_data:Object.fromEntries(header.map((k,j)=>[k,r[j]]))};
 }catch(e){throw Error(`Fila ${i+2}: ${e instanceof Error?e.message:'Datos no válidos.'}`)}});
}
