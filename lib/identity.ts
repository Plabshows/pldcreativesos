export type Identity={id:string;real_name?:string;name?:string;stage_name?:string|null;aliases?:string[];email?:string|null;phone?:string|null;tax_id?:string;iban?:string;deleted_at?:string|null;merged_into?:string|null};
export const identityKey=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const identityNames=(p:Identity)=>[p.real_name||p.name||'',p.stage_name||'',...(p.aliases||[])].filter(Boolean);
const emails=(p:Identity)=>(p.email||'').toLowerCase().split(/[;,\s]+/).filter(v=>v.includes('@'));
export function identityMatch(a:Identity,b:Identity){
 const sharedEmail=emails(a).some(e=>emails(b).includes(e)),taxA=identityKey(a.tax_id||''),taxB=identityKey(b.tax_id||'');
 const exact=identityNames(a).some(n=>identityNames(b).some(m=>identityKey(n)===identityKey(m)));
 const words=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
 const similar=exact||identityNames(a).some(n=>identityNames(b).some(m=>{const x=words(n),y=words(m);if(!x.length||!y.length)return false;const prefix=x[0]!==y[0]&&(x.length===1||y.length===1)&&Math.min(x[0].length,y[0].length)===4&&Math.abs(x[0].length-y[0].length)<=3&&(x[0].startsWith(y[0])||y[0].startsWith(x[0]));return prefix||x[0]===y[0]&&(x.length===1||y.length===1||x.filter(w=>y.includes(w)).length>=2)}));
 const sharedTax=Boolean(taxA&&taxA===taxB),sharedIban=Boolean(a.iban&&identityKey(a.iban)===identityKey(b.iban||''));
 const phoneA=identityKey((a.phone||'').replace(/\.0$/,'')),phoneB=identityKey((b.phone||'').replace(/\.0$/,''));
 const sharedPhone=Boolean(phoneA&&phoneA===phoneB);
 const conflict=Boolean(taxA&&taxB&&taxA!==taxB);
 const reasons=[sharedTax?'Mismo documento fiscal':'',sharedEmail?'Mismo email':'',sharedPhone?'Mismo teléfono':'',sharedIban?'Mismo IBAN (puede pertenecer a una empresa)':'',similar?'Nombre o alias parecido':'',conflict?'Documentos fiscales distintos: confirmar identidad':''].filter(Boolean);
 const evidence=sharedTax||sharedEmail&&similar?'high':similar||sharedIban||sharedEmail||sharedPhone?'medium':'low';
 const confidence=conflict&&evidence!=='low'?'medium':evidence;
 return {confidence,reasons,conflict} as const;
}
export function resolveIdentity(people:Identity[],name:string){
 const active=people.filter(p=>!p.deleted_at&&!p.merged_into),key=identityKey(name);
 const exact=active.filter(p=>identityNames(p).some(n=>identityKey(n)===key));
 const candidates=exact.length?exact:active.filter(p=>identityMatch(p,{id:'input',real_name:name}).confidence!=='low');
 return {exact:exact.length===1?exact[0]:null,candidates};
}
export function validIban(raw:string){const value=raw.toUpperCase().replace(/[\s-]/g,'');if(!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value))return null;let n=0;for(const ch of value.slice(4)+value.slice(0,4)){for(const d of /[A-Z]/.test(ch)?String(ch.charCodeAt(0)-55):ch)n=(n*10+Number(d))%97}return n===1?value:null;}
