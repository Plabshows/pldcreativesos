import {loadShowImage} from '@/lib/server/show-image';
import {showTechPdf} from '@/lib/show-tech-pdf';
import {requireOrganization} from '@/lib/server/auth';
import {kitDocumentSchema} from '@/lib/show-kit';
export async function GET(req:Request){
 const a=await requireOrganization();if('error'in a)return a.error;
 if(!['admin','producer','sales'].includes(a.membership.role))return Response.json({error:'Sin permiso.'},{status:403});
 const id=new URL(req.url).searchParams.get('show');
 const {data:show}=await a.supabase.from('shows').select('name').eq('organization_id',a.membership.organization_id).eq('id',id).maybeSingle();
 const {data:section}=await a.supabase.from('show_kit_sections').select('document').eq('organization_id',a.membership.organization_id).eq('show_id',id).eq('section','tech').maybeSingle();
 if(!show||!section)return Response.json({error:'Guarda primero la ficha técnica.'},{status:404});
 const doc=kitDocumentSchema.safeParse(section.document);if(!doc.success)return Response.json({error:'Revisa los campos de la ficha.'},{status:400});
 try{const bytes=await showTechPdf(show.name,doc.data,loadShowImage);
 return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Performance-Lab-ficha-tecnica.pdf"','Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'No se pudo generar el PDF.'},{status:422});}
}
