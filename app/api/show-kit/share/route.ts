import {requireOrganization} from '@/lib/server/auth';
import {cleanDocument,kitDocumentSchema,emptyDocument} from '@/lib/show-kit';
import {z} from 'zod';
const input=z.union([z.object({revoke:z.uuid()}),z.object({show_id:z.uuid(),audience:z.enum(['artist','client']),event_id:z.uuid().optional(),talent_id:z.uuid().optional()})]);
export async function POST(req:Request){
 const a=await requireOrganization();if('error'in a)return a.error;
 const p=input.safeParse(await req.json().catch(()=>null));if(!p.success)return Response.json({error:'Solicitud no válida.'},{status:400});
 const b=p.data,org=a.membership.organization_id;
 if('revoke'in b){const r=await a.supabase.from('show_kit_shares').update({revoked_at:new Date().toISOString()}).eq('id',b.revoke).eq('organization_id',org).select('id');return r.error||!r.data?.length?Response.json({error:'No se pudo revocar.'},{status:403}):Response.json({ok:true});}
 if(!['admin','producer',...(b.audience==='client'?['sales']:[])].includes(a.membership.role))return Response.json({error:'Sin permiso para compartir este material.'},{status:403});
 const {data:show}=await a.supabase.from('shows').select('name').eq('id',b.show_id).eq('organization_id',org).maybeSingle();if(!show)return Response.json({error:'Show no disponible.'},{status:404});
 const types=b.audience==='artist'?['artist']:['tech','media'];const r=await a.supabase.from('show_kit_sections').select('section,document').eq('organization_id',org).eq('show_id',b.show_id).in('section',types);
 if(r.error||!r.data?.length)return Response.json({error:'Completa y guarda la ficha antes de compartir.'},{status:400});
 let event:Record<string,unknown>|undefined;
 if(b.event_id){
 if(b.audience!=='artist'||!b.talent_id)return Response.json({error:'Selecciona el artista asignado.'},{status:400});
 const ev=await a.supabase.from('events').select('event_name,event_date,venue,city').eq('id',b.event_id).eq('organization_id',org).is('deleted_at',null).maybeSingle();
 const link=await a.supabase.from('event_shows').select('id').eq('event_id',b.event_id).eq('show_id',b.show_id).eq('organization_id',org).maybeSingle();
 const assignment=await a.supabase.from('event_talent').select('talent_id').eq('event_id',b.event_id).eq('talent_id',b.talent_id).eq('organization_id',org).neq('status','cancelled').maybeSingle();
 const talent=await a.supabase.from('talent').select('real_name').eq('id',b.talent_id).eq('organization_id',org).maybeSingle();
 if(!ev.data||!link.data||!assignment.data||!talent.data)return Response.json({error:'El show y el artista deben estar vinculados a este evento.'},{status:400});
 event={...ev.data,artist:talent.data.real_name};
 }
 const sections=r.data.map(s=>{const doc=cleanDocument(s.section,kitDocumentSchema.parse(s.document));return s.section==='media'?{section:s.section,document:{...emptyDocument(),assets:doc.assets.filter(asset=>asset.approved)}}:{section:s.section,document:doc};});
 const saved=await a.supabase.from('show_kit_shares').insert({organization_id:org,show_id:b.show_id,audience:b.audience,document:{name:show.name,audience:b.audience,sections,...(event?{event}:{})}}).select('id,token,expires_at').single();
 if(saved.error)return Response.json({error:'No se pudo crear el enlace.'},{status:400});
 return Response.json({id:saved.data.id,path:'/brief/'+saved.data.token,expires_at:saved.data.expires_at});
}

export async function GET(req:Request){
 const a=await requireOrganization();if('error'in a)return a.error;
 const id=new URL(req.url).searchParams.get('show');if(!z.uuid().safeParse(id).success)return Response.json({error:'Show no válido.'},{status:400});
 const result=[];for(let offset=0;;offset+=500){const r=await a.supabase.from('show_kit_shares').select('id,token,audience,created_at,expires_at,revoked_at').eq('organization_id',a.membership.organization_id).eq('show_id',id).order('created_at',{ascending:false}).order('id').range(offset,offset+499);if(r.error)return Response.json({error:'No se pudieron cargar los enlaces.'},{status:503});result.push(...r.data);if(r.data.length<500)break;}
 return Response.json({links:result},{headers:{'Cache-Control':'no-store'}});
}
