import type {ContextGraph} from './contracts';
const contactKeys=new Set(['email','phone','whatsapp','telephone','mobile','address','personal_address','street_address','postal_address','fiscal_data']);
export function privacyFilter(graph:ContextGraph,includePersonalData:boolean){
 const values=new Set<string>();
 function collect(value:unknown){if(!value||typeof value!=='object')return;for(const [k,v] of Object.entries(value)){if(contactKeys.has(k)&&typeof v==='string'&&v.trim().length>=4)values.add(v.trim());else if(v&&typeof v==='object')collect(v);}}
 collect(graph);
 return (text:string)=>{
  if(includePersonalData)return text;
  let result=text;for(const value of [...values].sort((a,b)=>b.length-a.length))result=result.split(value).join('[dato personal omitido]');
  result=result.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email omitido]');
  result=result.replace(/(?:https?:\/\/)?(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)\d+/gi,'[contacto omitido]');
  result=result.replace(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,5}\d{2,4}/g,(match,offset,source)=>{if(/^\s*(?:EUR|USD|GBP|€|\$|£)/.test(source.slice(offset+match.length)))return match;const digits=match.replace(/\D/g,'');if(/^\d{4}-\d{2}-\d{2}$/.test(match))return match;return digits.length>=9&&digits.length<=15?'[teléfono omitido]':match;});
  // Unstructured addresses are withheld conservatively; the preview is still editable.
  result=result.replace(/[^\n]*(?:domicilio|direcci[oó]n\s*(?:personal|:)|home address|personal address|address\s*:|\bc\/\s*|calle\s|avenida\s|\bstreet\b|\broad\b)[^\n]*/gi,'[línea con posible dirección omitida]');
  return result;
 };
}
export function cleanContext(value:unknown):unknown{
 if(value===null||value===undefined||typeof value==='string'&&!value.trim())return undefined;
 if(Array.isArray(value)){const items=value.map(cleanContext).filter(v=>v!==undefined);return items.length?items:undefined;}
 if(typeof value==='object'){const entries=Object.entries(value as object).map(([k,v])=>[k,cleanContext(v)]).filter(([,v])=>v!==undefined);return entries.length?Object.fromEntries(entries):undefined;}
 return value;
}
