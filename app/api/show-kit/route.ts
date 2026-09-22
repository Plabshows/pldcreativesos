import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireOrganization} from '@/lib/server/auth';
import {rows} from '@/lib/server/workspace-data';
import {canReadSection,cleanDocument,kitDocumentSchema} from '@/lib/show-kit';
const schema=z.object({show_id:z.uuid(),section:z.enum(['sales','media','tech','artist','warehouse','maintenance']),version:z.number().int().positive().nullable(),document:kitDocumentSchema});
export async function GET(){
 const a=await requireOrganization();if('error'in a)return a.error;
 try{const catalog=await a.supabase.rpc('show_kit_catalogue');if(catalog.error)throw catalog.error;
 const sections=[];for(let offset=0;;offset+=500){const result=await a.supabase.from('show_kit_sections').select('*').eq('organization_id',a.membership.organization_id).order('show_id').order('section').range(offset,offset+499);if(result.error)throw result.error;sections.push(...result.data);if(result.data.length<500)break;}
 const inventory=['admin','producer','wardrobe'].includes(a.membership.role)?await rows(a.supabase,a.membership.organization_id,'inventory_concepts','id,name,main_image,default_location'):[];
 return NextResponse.json({shows:catalog.data.filter((s:{organization_id:string})=>s.organization_id===a.membership.organization_id),sections,inventory,role:a.membership.role},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'No se pudo cargar la ficha maestra. Revisa la conexión y la migración de Sales Kit.'},{status:503});}
}
export async function POST(req:Request){
 const a=await requireOrganization();if('error'in a)return a.error;
 const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:p.error.issues[0].message},{status:400});
 const b=p.data;if(!canReadSection(a.membership.role,b.section))return NextResponse.json({error:'No tienes permiso para esta pestaña.'},{status:403});
 const document=cleanDocument(b.section,b.document),org=a.membership.organization_id;
 for(const item of document.items){if(item.concept_id){const ref=await a.supabase.from('inventory_concepts').select('id').eq('organization_id',org).eq('id',item.concept_id).maybeSingle();if(ref.error||!ref.data)return NextResponse.json({error:'Artículo de inventario no disponible en este espacio.'},{status:400});}}
 const r=b.version?await a.supabase.from('show_kit_sections').update({document}).eq('organization_id',org).eq('show_id',b.show_id).eq('section',b.section).eq('version',b.version).select('version'):await a.supabase.from('show_kit_sections').insert({organization_id:org,show_id:b.show_id,section:b.section,document}).select('version');
 if(r.error||!r.data?.length)return NextResponse.json({error:r.error?.code==='23505'||!r.error?'Otra persona ha modificado esta pestaña. Recarga antes de editar.':'No se pudo guardar esta ficha.'},{status:r.error?.code==='23505'||!r.error?409:400});
 return NextResponse.json({version:r.data[0].version});
}
