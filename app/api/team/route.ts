import {NextResponse} from 'next/server';
import {requireOrganization} from '@/lib/server/auth';
export async function GET(){
  const a=await requireOrganization();if('error'in a)return a.error;
  const {data,error}=await a.supabase.from('organization_members').select('user_id,role,users(full_name,email)').eq('organization_id',a.membership.organization_id);
  if(error)return NextResponse.json({error:'No se pudo cargar el equipo.'},{status:503});
  return NextResponse.json({members:data.map(m=>{const u=m.users as unknown as {full_name:string;email:string}|null;return {id:m.user_id,role:m.role,name:u?.full_name||u?.email||'Miembro',email:u?.email||''};})});
}
