import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {requireOrganization} from '@/lib/server/auth';
import {clientSheet,kitDocumentSchema} from '@/lib/show-kit';
export async function GET(req:Request){
 const a=await requireOrganization();if('error'in a)return a.error;
 if(!['admin','producer','sales'].includes(a.membership.role))return Response.json({error:'Sin permiso.'},{status:403});
 const id=new URL(req.url).searchParams.get('show');
 const {data:show}=await a.supabase.from('shows').select('name').eq('organization_id',a.membership.organization_id).eq('id',id).maybeSingle();
 const {data:section}=await a.supabase.from('show_kit_sections').select('document').eq('organization_id',a.membership.organization_id).eq('show_id',id).eq('section','tech').maybeSingle();
 if(!show||!section)return Response.json({error:'Guarda primero la ficha técnica.'},{status:404});
 const doc=kitDocumentSchema.safeParse(section.document);if(!doc.success)return Response.json({error:'Revisa los campos de la ficha.'},{status:400});
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);let page=pdf.addPage(),y=790;
 const text=(value:string,size=11)=>{const safe=Array.from(value).map(c=>{try{font.encodeText(c);return c;}catch{return '?';}}).join('');for(const line of safe.split('\n')){let part='';for(const word of line.split(' ')){if(font.widthOfTextAtSize(part+' '+word,size)>480&&part){draw(part,size);part='';}part+=(part?' ':'')+word;}draw(part,size);}};
 const draw=(line:string,size:number)=>{if(y<55){page=pdf.addPage();y=790;}page.drawText(line,{x:50,y,size,font,color:rgb(.14,.13,.2)});y-=size+7;};
 text('PERFORMANCE LAB · FICHA TÉCNICA',12);text(show.name,22);y-=12;
 for(const row of clientSheet(doc.data)){text(row.label,12);text(row.value);y-=8;}
 return new Response(new Uint8Array(await pdf.save()),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Performance-Lab-ficha-tecnica.pdf"','Cache-Control':'no-store'}});
}
