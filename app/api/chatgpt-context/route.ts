import {NextResponse} from 'next/server';
import {requireOrganization} from '@/lib/server/auth';
import {contextRequestSchema} from '@/lib/chatgpt/contracts';
import {buildChatGPTContext} from '@/lib/chatgpt/build-context';
import {contextRepository} from '@/lib/server/chatgpt/repository';
import {getChatGPTContext} from '@/lib/server/chatgpt/context-service';
import {canReadChatGPTContext,ContextNotFound} from '@/lib/server/chatgpt/permissions';
export async function POST(request:Request){
 const auth=await requireOrganization();if('error'in auth)return auth.error;
 if(!canReadChatGPTContext(auth.membership.role))return NextResponse.json({error:'Tu rol no permite preparar este contexto.'},{status:403});
 const parsed=contextRequestSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Revisa el registro, la acción y la pregunta.'},{status:400});
 try{const graph=await getChatGPTContext(contextRepository(auth.supabase,auth.membership.organization_id),parsed.data);return NextResponse.json(buildChatGPTContext(graph,parsed.data),{headers:{'Cache-Control':'no-store'}});}
 catch(error){return NextResponse.json({error:error instanceof ContextNotFound?error.message:'No se pudo preparar el contexto. Reintenta la conexión.'},{status:error instanceof ContextNotFound?404:503,headers:{'Cache-Control':'no-store'}});}
}
