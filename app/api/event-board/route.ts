import {NextResponse} from 'next/server';
import {z} from 'zod';
import {artistBeforeCreate} from '@/lib/server/identity';
import {requireOrganization} from '@/lib/server/auth';

const fields=z.object({income_cents:z.number().int().min(0).max(100000000000).nullable().optional(),expenses_cents:z.number().int().min(0).max(100000000000).nullable().optional(),other_expenses_cents:z.number().int().min(0).max(100000000000).nullable().optional(),client_paid:z.boolean().nullable().optional(),billing_type:z.enum(['invoice','cash']).optional(),invoice_number:z.string().max(500).optional(),event_name:z.string().trim().min(1).max(500).optional(),event_date:z.string().date().nullable().optional(),client_id:z.string().uuid().nullable().optional(),city:z.string().max(200).optional(),venue:z.string().max(500).optional(),internal_notes:z.string().max(20000).optional(),wardrobe_notes:z.string().max(10000).optional(),status:z.enum(['lead','proposal','confirmed','production','completed','cancelled']).optional(),board_position:z.number().finite().optional(),deleted_at:z.string().datetime().nullable().optional()}).strict();

const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('update'),ids:z.array(z.string().uuid()).min(1).max(1000),patch:fields}),
 z.object({action:z.literal('create'),patch:fields.extend({event_name:z.string().trim().min(1).max(500)})}),
 z.object({action:z.literal('duplicate'),ids:z.array(z.string().uuid()).min(1).max(20)}),
 z.object({action:z.literal('createTalent'),real_name:z.string().trim().min(1).max(200),category:z.string().max(120).optional(),notes:z.string().max(10000).optional()}),
 z.object({action:z.literal('createShow'),name:z.string().trim().min(1).max(300),category:z.string().max(120).optional(),description:z.string().max(20000).optional()}),
 z.object({action:z.literal('relation'),event_id:z.string().uuid(),kind:z.enum(['talent','shows']),target:z.string().uuid(),remove:z.boolean(),forceRemove:z.boolean().optional()}),
 z.object({action:z.literal('artistFee'),event_id:z.string().uuid(),talent_id:z.string().uuid(),fee_cents:z.number().int().min(0).max(100000000).nullable(),status:z.enum(['pending','paid']).optional()}),
 z.object({action:z.literal('providerExpense'),event_id:z.string().uuid(),supplier_id:z.string().uuid().nullable().optional(),supplier_name:z.string().trim().max(200).optional(),expense_id:z.string().uuid().optional(),amount_cents:z.number().int().min(0).max(100000000).nullable(),payment_status:z.enum(['pending','paid']).optional(),remove:z.boolean().optional()})
]);

async function syncEventExpensesTotal(supabase: any, org: string, eventId: string) {
 const [talentRes, expenseRes] = await Promise.all([
  supabase.from('event_talent').select('agreed_cost_cents').eq('organization_id', org).eq('event_id', eventId),
  supabase.from('expenses').select('total_cents').eq('organization_id', org).eq('event_id', eventId).is('talent_id', null)
 ]);
 const talentSum = (talentRes.data || []).reduce((sum: number, r: any) => sum + Number(r.agreed_cost_cents || 0), 0);
 const expenseSum = (expenseRes.data || []).reduce((sum: number, r: any) => sum + Number(r.total_cents || 0), 0);
 const totalCents = talentSum + expenseSum;
 await supabase.from('events').update({ expenses_cents: totalCents, updated_at: new Date().toISOString() }).eq('organization_id', org).eq('id', eventId);
}

export async function GET(){
 const a=await requireOrganization();if('error'in a)return a.error;const org=a.membership.organization_id;
  const queries=[
   a.supabase.from('events').select('*').eq('organization_id',org).order('event_date',{ascending:false,nullsFirst:false}).range(0,999),
   a.supabase.from('clients').select('id,company_name,group_id').eq('organization_id',org).is('deleted_at',null).order('company_name').range(0,999),
   a.supabase.from('talent').select('id,real_name,city,email,phone,notes,skills,deleted_at,aliases,tax_id,iban,billing_supplier_id,billing_confidence,identity_sources,merged_into').eq('organization_id',org).order('real_name').range(0,999),
   a.supabase.from('shows').select('id,name').eq('organization_id',org).eq('active',true).order('name').range(0,999),
   a.supabase.from('event_talent').select('*').eq('organization_id',org).range(0,999),
   a.supabase.from('event_shows').select('*').eq('organization_id',org).range(0,999),
   a.supabase.from('client_groups').select('id,name').eq('organization_id',org).order('position'),
   a.supabase.from('event_places').select('kind,name').eq('organization_id',org).order('name').range(0,999),
   a.supabase.from('suppliers').select('id,name').eq('organization_id',org).is('deleted_at',null).order('name').range(0,999),
   a.supabase.from('expenses').select('id,event_id,supplier_name,talent_id,total_cents,status,concept').eq('organization_id',org).not('event_id','is',null).range(0,999),
   a.supabase.from('payments').select('id,event_id,talent_id,status,amount_cents').eq('organization_id',org).eq('kind','artist').range(0,999)
  ];
  const r=await Promise.all(queries);
  const err=r.find(x=>x.error)?.error;
  if(err){
   console.error('[api/event-board GET Error]:', err);
   return NextResponse.json({error:'No se pudo cargar el tablero de eventos: '+err.message},{status:500});
  }
  return NextResponse.json({
   groups:r[6].data,places:r[7].data,events:r[0].data,clients:r[1].data,talent:r[2].data,shows:r[3].data,assignments:r[4].data,showLinks:r[5].data,suppliers:r[8].data,expenses:r[9].data,payments:r[10].data,canEdit:['admin','producer'].includes(a.membership.role)
  });
 }

export async function POST(req:Request){
 const a=await requireOrganization();if('error'in a)return a.error;if(!['admin','producer'].includes(a.membership.role))return NextResponse.json({error:'Tu perfil no permite editar eventos.'},{status:403});
 const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success) {
  console.error('[API Zod Error]', p.error);
  return NextResponse.json({error:'Revisa los campos y la fecha: ' + p.error.message},{status:400});
 }
 const b=p.data,org=a.membership.organization_id;let r;
 if(b.action==='artistFee'){
  const fee = b.fee_cents ?? 0;
  // 1. Update event_talent
  const et = await a.supabase.from('event_talent').update({
   agreed_cost_cents: fee
  }).eq('organization_id', org).eq('event_id', b.event_id).eq('talent_id', b.talent_id);
  if(et.error) return NextResponse.json({error:'No se pudo guardar el fee del artista.'},{status:400});

  // 2. Sync to payments table (Single Source of Truth)
  const existingPay = await a.supabase.from('payments').select('id,status,paid_on').eq('organization_id',org).eq('event_id',b.event_id).eq('talent_id',b.talent_id).eq('kind','artist').eq('direction','outbound').maybeSingle();
  const status = b.status ?? (existingPay.data?.status || 'pending');
  const payPatch = {
   amount_cents: fee,
   status: status,
   paid_on: status === 'paid' ? (existingPay.data?.paid_on || new Date().toISOString().slice(0, 10)) : null
  };
  if (existingPay.data) {
   await a.supabase.from('payments').update(payPatch).eq('id', existingPay.data.id);
  } else {
   await a.supabase.from('payments').insert({
    organization_id: org,
    event_id: b.event_id,
    talent_id: b.talent_id,
    kind: 'artist',
    direction: 'outbound',
    ...payPatch
   });
  }

  // 3. Sync to expenses table if one exists
  await a.supabase.from('expenses').update({
    total_cents: fee
  }).eq('organization_id', org).eq('event_id', b.event_id).eq('talent_id', b.talent_id);

  // 4. Recalculate event expenses_cents total
  await syncEventExpensesTotal(a.supabase, org, b.event_id);

  return NextResponse.json({ok:true});
 } else if (b.action === 'providerExpense') {
  if (b.remove && b.expense_id) {
   await a.supabase.from('expenses').delete().eq('organization_id', org).eq('id', b.expense_id);
   await syncEventExpensesTotal(a.supabase, org, b.event_id);
   return NextResponse.json({ok:true});
  }

  let supplierId = b.supplier_id;
  if (!supplierId && b.supplier_name?.trim()) {
   const normalized = b.supplier_name.trim().toLowerCase();
   const existingSupp = await a.supabase.from('suppliers').select('id').eq('organization_id', org).eq('normalized_name', normalized).is('deleted_at', null).maybeSingle();
   if (existingSupp.data) {
    supplierId = existingSupp.data.id;
   } else {
    const newSupp = await a.supabase.from('suppliers').insert({
     organization_id: org,
     name: b.supplier_name.trim(),
     normalized_name: normalized
    }).select('id').single();
    if (newSupp.data) supplierId = newSupp.data.id;
   }
  }

  const expData = {
   organization_id: org,
   event_id: b.event_id,
   supplier_id: supplierId || null,
   amount_cents: b.amount_cents ?? 0,
   payment_status: b.payment_status || 'pending',
   description: b.supplier_name ? `Proveedor: ${b.supplier_name}` : 'Proveedor del evento'
  };

  if (b.expense_id) {
   await a.supabase.from('expenses').update(expData).eq('organization_id', org).eq('id', b.expense_id);
  } else {
   await a.supabase.from('expenses').insert(expData);
  }

  await syncEventExpensesTotal(a.supabase, org, b.event_id);
  return NextResponse.json({ok:true});
 } else if(b.action==='relation'){
  const ev=await a.supabase.from('events').select('id').eq('organization_id',org).eq('id',b.event_id).is('deleted_at',null).maybeSingle();
  let targetQuery=a.supabase.from(b.kind).select('id').eq('organization_id',org).eq('id',b.target);if(b.kind==='talent'&&!b.remove)targetQuery=targetQuery.is('deleted_at',null);const target=await targetQuery.maybeSingle();
  if(!ev.data||!target.data)return NextResponse.json({error:'Evento o registro no disponible.'},{status:400});
  const table=b.kind==='talent'?'event_talent':'event_shows',key=b.kind==='talent'?'talent_id':'show_id';

  if (b.kind === 'talent' && b.remove) {
   // Check if financial history exists (paid payment or expense)
   const [payCheck, expCheck] = await Promise.all([
    a.supabase.from('payments').select('id,status').eq('organization_id', org).eq('event_id', b.event_id).eq('talent_id', b.target).eq('status', 'paid').maybeSingle(),
    a.supabase.from('expenses').select('id,payment_status').eq('organization_id', org).eq('event_id', b.event_id).eq('talent_id', b.target).eq('payment_status', 'paid').is('deleted_at', null).maybeSingle()
   ]);

   if ((payCheck.data || expCheck.data) && !b.forceRemove) {
    return NextResponse.json({
     ok: false,
     requiresConfirmation: true,
     warning: 'Este artista ya tiene información financiera asociada. ¿Quieres quitarlo del evento manteniendo el histórico?'
    }, { status: 200 });
   }

   // Perform removal
   r = await a.supabase.from('event_talent').delete().eq('organization_id', org).eq('event_id', b.event_id).eq('talent_id', b.target);
   if (!b.forceRemove) {
    // Also remove unpaid pending payments
    await a.supabase.from('payments').delete().eq('organization_id', org).eq('event_id', b.event_id).eq('talent_id', b.target).eq('kind', 'artist').neq('status', 'paid');
   }
   await syncEventExpensesTotal(a.supabase, org, b.event_id);
  } else {
   r=b.remove?await a.supabase.from(table).delete().eq('organization_id',org).eq('event_id',b.event_id).eq(key,b.target):await a.supabase.from(table).upsert({organization_id:org,event_id:b.event_id,[key]:b.target},{onConflict:'event_id,'+key,ignoreDuplicates:true});
   if (b.kind === 'talent') {
    await syncEventExpensesTotal(a.supabase, org, b.event_id);
   }
  }
 }else if(b.action==='createTalent'){
  const match=await artistBeforeCreate(a.supabase,org,b.real_name);
  if(match.exact)return NextResponse.json({ok:true,value:match.exact.id,name:match.exact.real_name});
  if(match.candidates.length)return NextResponse.json({error:'Posible coincidencia: selecciona la ficha existente o revisa la identidad antes de crear otra.',candidates:match.candidates.map(p=>({id:p.id,name:p.real_name}))},{status:409});
  r=await a.supabase.from('talent').insert({organization_id:org,talent_code:'TL-'+crypto.randomUUID(),real_name:b.real_name,notes:[b.category,b.notes].filter(Boolean).join(' · ')||null}).select('id,real_name').single();
 }else if(b.action==='createShow'){
  r=await a.supabase.from('shows').insert({organization_id:org,show_code:'SH-'+crypto.randomUUID(),name:b.name,category:b.category||null,description:b.description||null,active:true}).select('id,name').single();
 }else if(b.action==='duplicate'){
  const originals=await a.supabase.from('events').select('*').eq('organization_id',org).in('id',b.ids).is('deleted_at',null);
  if(originals.error)return NextResponse.json({error:'No se pudieron leer los eventos.'},{status:400});
  const copies=(originals.data||[]).map((e:any)=>{const {id,created_at,updated_at,event_code,...rest}=e;return {...rest,organization_id:org,event_code:'EV-'+crypto.randomUUID(),event_name:`${e.event_name} (copia)`,status:'production',owner_id:a.userId,board_position:(e.board_position||0)+1};});
  r= copies.length ? await a.supabase.from('events').insert(copies).select('id') : {error:null,data:[]};
 }else{
  if(b.patch.client_id){const c=await a.supabase.from('clients').select('id').eq('id',b.patch.client_id).eq('organization_id',org).is('deleted_at',null).maybeSingle();if(!c.data)return NextResponse.json({error:'Cliente no disponible.'},{status:400});}
  r=b.action==='create'?await a.supabase.from('events').insert({...b.patch,organization_id:org,event_code:'EV-'+crypto.randomUUID(),owner_id:a.userId}).select('id'):await a.supabase.from('events').update({...b.patch,updated_at:new Date().toISOString()}).eq('organization_id',org).in('id',b.ids).select('id');
  if(!r.error&&!r.data?.length)return NextResponse.json({error:'Evento no disponible. Actualiza el tablero.'},{status:409});
 }
 return r.error?NextResponse.json({error:'No se pudo guardar. El cambio no se ha aplicado.'},{status:400}):NextResponse.json({ok:true});
}
