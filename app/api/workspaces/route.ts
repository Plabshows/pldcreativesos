import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';

const createSchema=z.object({name:z.string().trim().min(2).max(80)}).strict();

async function session(){const supabase=await createClient();const {data,error}=await supabase.auth.getClaims();const userId=data?.claims?.sub;if(error||!userId)return {error:NextResponse.json({error:'Necesitas iniciar sesión.'},{status:401})} as const;return {supabase,userId} as const;}

export async function GET(){const a=await session();if('error'in a)return a.error;const {data,error}=await a.supabase.from('organization_members').select('organization_id,role,organizations(id,name,slug)').eq('user_id',a.userId).order('created_at');if(error)return NextResponse.json({error:'No se pudieron cargar los espacios.'},{status:500});const selected=(await cookies()).get('plab_org')?.value;const activeId=data?.find(row=>row.organization_id===selected)?.organization_id||data?.[0]?.organization_id||null;return NextResponse.json({activeId,workspaces:(data||[]).map(row=>({id:row.organization_id,role:row.role,name:(row.organizations as unknown as {name?:string}|null)?.name||'Espacio sin nombre'}))});}

export async function POST(req:Request){const a=await session();if('error'in a)return a.error;const body=createSchema.safeParse(await req.json().catch(()=>null));if(!body.success)return NextResponse.json({error:'Escribe un nombre de entre 2 y 80 caracteres.'},{status:400});const {data,error}=await a.supabase.rpc('create_workspace',{workspace_name:body.data.name});if(error)return NextResponse.json({error:error.message||'No se pudo crear el espacio.'},{status:400});const response=NextResponse.json({workspace:{id:data,name:body.data.name,role:'admin'}},{status:201});response.cookies.set('plab_org',data,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*365});return response;}

export async function PUT(req:Request){const a=await session();if('error'in a)return a.error;const body=z.object({workspaceId:z.string().uuid()}).safeParse(await req.json().catch(()=>null));if(!body.success)return NextResponse.json({error:'Espacio no válido.'},{status:400});const {data,error}=await a.supabase.from('organization_members').select('organization_id').eq('organization_id',body.data.workspaceId).eq('user_id',a.userId).maybeSingle();if(error||!data)return NextResponse.json({error:'No tienes acceso a este espacio.'},{status:403});const response=NextResponse.json({ok:true});response.cookies.set('plab_org',body.data.workspaceId,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*365});return response;}
