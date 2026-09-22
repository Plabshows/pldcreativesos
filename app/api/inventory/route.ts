import {NextResponse} from 'next/server';
import {requireOrganization} from '@/lib/server/auth';
import {z} from 'zod';

const conceptSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  category: z.enum(['Characters', 'Costumes', 'Heads', 'Props', 'Accessories', 'Technical', 'Other']),
  description: z.string().nullable().optional(),
  main_image: z.string().nullable().optional(),
  default_location: z.string().nullable().optional(),
  production_cost: z.number().int().min(0).nullable().optional(),
  replacement_value: z.number().int().min(0).nullable().optional(),
  suggested_rental_price: z.number().int().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
  subcategory: z.string().nullable().optional(),
  family: z.string().nullable().optional(),
  owner_name: z.string().nullable().optional(),
  review_status: z.string().nullable().optional(),
  performer_price: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
});

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  concept_id: z.string().uuid(),
  item_code: z.string().trim().min(1).max(100),
  name: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  condition: z.enum(['NEW', 'EXCELLENT', 'GOOD', 'USED', 'DAMAGED', 'UNCHECKED']).default('UNCHECKED'),
  status: z.enum(['AVAILABLE', 'RESERVED', 'OUT', 'REPAIR', 'CLEANING', 'LOST', 'RETIRED']).default('AVAILABLE'),
  location: z.string().nullable().optional(),
  sublocation: z.string().nullable().optional(),
  purchase_cost: z.number().int().min(0).nullable().optional(),
  estimated_value: z.number().int().min(0).nullable().optional(),
  purchase_or_build_date: z.string().nullable().optional(),
  production_cost: z.number().int().min(0).nullable().optional(),
  replacement_value: z.number().int().min(0).nullable().optional(),
  main_image: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const repairSchema = z.object({
  id: z.string().uuid().optional(),
  inventory_item_id: z.string().uuid(),
  date_reported: z.string().optional(),
  problem: z.string().trim().min(1),
  incident_type: z.enum(['damage','lost','repair','cleaning']).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'NOT_REPAIRABLE']).default('PENDING'),
  estimated_cost: z.number().int().min(0).nullable().optional(),
  actual_cost: z.number().int().min(0).nullable().optional(),
  assigned_to: z.string().nullable().optional(),
  date_completed: z.string().nullable().optional(),
  before_image: z.string().nullable().optional(),
  after_image: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const allocationSchema = z.object({
  id: z.string().uuid().optional(),
  event_id: z.string().uuid(),
  concept_id: z.string().uuid(),
  inventory_item_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).default(1),
  status: z.enum(['RESERVED', 'OUT', 'RETURNED', 'CANCELLED']).default('RESERVED'),
  out_at: z.string().nullable().optional(),
  returned_at: z.string().nullable().optional(),
  rental_revenue: z.number().int().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
  return_item_status: z.enum(['AVAILABLE', 'REPAIR', 'CLEANING', 'LOST']).optional(),
});

export async function GET() {
  const auth = await requireOrganization();
  if ('error' in auth) return auth.error;
  const {supabase, membership} = auth;
  const orgId = membership.organization_id;

  const [conceptsRes, itemsRes, repairsRes, allocationsRes, eventsRes] = await Promise.all([
    supabase.from('inventory_concepts').select('*').eq('organization_id', orgId).order('name'),
    supabase.from('inventory_items').select('*').eq('organization_id', orgId).order('item_code'),
    supabase.from('inventory_repairs').select('*').eq('organization_id', orgId).order('date_reported', {ascending: false}),
    supabase.from('inventory_event_allocations').select('*, events(id, event_name, event_date)').eq('organization_id', orgId),
    supabase.from('events').select('id, event_name, event_date, client_id, status').eq('organization_id', orgId).is('deleted_at', null).order('event_date', {ascending: false})
  ]);

  if (conceptsRes.error) return NextResponse.json({error: conceptsRes.error.message}, {status: 500});
  if (itemsRes.error) return NextResponse.json({error: itemsRes.error.message}, {status: 500});
  if (repairsRes.error) return NextResponse.json({error: repairsRes.error.message}, {status: 500});
  if (allocationsRes.error) return NextResponse.json({error: allocationsRes.error.message}, {status: 500});
  if (eventsRes.error) return NextResponse.json({error: 'No se pudieron cargar los eventos del inventario.'}, {status: 500});

  const concepts = conceptsRes.data || [];
  const items = itemsRes.data || [];
  const repairs = repairsRes.data || [];
  const allocations = allocationsRes.data || [];
  const events = eventsRes.data || [];

  const totalConcepts = concepts.length;
  const totalUnits = items.filter(i => i.status !== 'RETIRED').length;
  const availableUnits = items.filter(i => i.status === 'AVAILABLE').length;
  const reservedUnits = items.filter(i => i.status === 'RESERVED').length;
  const outUnits = items.filter(i => ['OUT','RENTED'].includes(i.status)).length;
  const repairUnits = items.filter(i => i.status === 'REPAIR').length;
  const cleaningUnits = items.filter(i => i.status === 'CLEANING').length;
  const lostUnits = items.filter(i => i.status === 'LOST').length;

  const totalInventoryValue = items.reduce((acc, i) => acc + (i.estimated_value ?? 0), 0);
  const totalRepairCost = repairs.reduce((acc, r) => acc + (r.actual_cost ?? 0), 0);

  const attentionItems = items.filter(i => ['REPAIR', 'CLEANING', 'LOST'].includes(i.status) || !i.location || ['DAMAGED','UNCHECKED'].includes(i.condition)).map(i => {
    const concept = concepts.find(c => c.id === i.concept_id);
    const activeRepair = repairs.find(r => r.inventory_item_id === i.id && ['PENDING', 'IN_PROGRESS'].includes(r.status));
    return {
      id: i.id,
      item_code: i.item_code,
      name: i.name || concept?.name || 'Unidad',
      concept_id: i.concept_id,
      concept_name: concept?.name || 'Concepto',
      status: i.status,
      condition: i.condition,
      location: i.location || 'Sin ubicación',
      issue: i.status === 'REPAIR' ? `Reparación: ${activeRepair?.problem || 'Pendiente'}` : i.status === 'CLEANING' ? 'Limpieza pendiente' : i.status === 'LOST' ? 'Unidad perdida' : !i.location ? 'Sin ubicación asignada' : i.condition === 'UNCHECKED' ? 'Por revisar' : 'Dañado',
    };
  });

  return NextResponse.json({
    data: {
      concepts,
      items,
      repairs,
      allocations,
      events,
      metrics: {
        totalConcepts,
        totalUnits,
        availableUnits,
        reservedUnits,
        outUnits,
        repairUnits,
        cleaningUnits,
        lostUnits,
        totalInventoryValue,
        totalRepairCost,
      },
      attentionItems,
    }
  });
}

export async function POST(req: Request) {
  const auth = await requireOrganization();
  if ('error' in auth) return auth.error;
  const {supabase, membership} = auth;
  const orgId = membership.organization_id;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== 'string') {
    return NextResponse.json({error: 'Acción no especificada.'}, {status: 400});
  }

  const {action} = body;

  if (action === 'saveConcept') {
    const parse = conceptSchema.safeParse(body.concept);
    if (!parse.success) return NextResponse.json({error: 'Datos del concepto no válidos.'}, {status: 400});
    const c = parse.data;

    if (c.id) {
      const {data, error} = await supabase.from('inventory_concepts').update({
        subcategory: c.subcategory, family: c.family, owner_name: c.owner_name,
        review_status: c.review_status, performer_price: c.performer_price, active: c.active,
        name: c.name,
        category: c.category,
        description: c.description,
        main_image: c.main_image,
        default_location: c.default_location,
        production_cost: c.production_cost,
        replacement_value: c.replacement_value,
        suggested_rental_price: c.suggested_rental_price,
        notes: c.notes,
        updated_at: new Date().toISOString(),
      }).eq('id', c.id).eq('organization_id', orgId).select().single();
      if (error) return NextResponse.json({error: error.message}, {status: 500});
      return NextResponse.json({data});
    } else {
      const {data, error} = await supabase.from('inventory_concepts').insert({
        organization_id: orgId,
        subcategory: c.subcategory, family: c.family, owner_name: c.owner_name,
        review_status: c.review_status, performer_price: c.performer_price, active: c.active,
        name: c.name,
        category: c.category,
        description: c.description,
        main_image: c.main_image,
        default_location: c.default_location || 'Ibiza Warehouse',
        production_cost: c.production_cost,
        replacement_value: c.replacement_value,
        suggested_rental_price: c.suggested_rental_price,
        notes: c.notes,
      }).select().single();
      if (error) return NextResponse.json({error: error.message}, {status: 500});
      return NextResponse.json({data});
    }
  }

  if (action === 'saveItem') {
    const parse = itemSchema.safeParse(body.item);
    if (!parse.success) return NextResponse.json({error: 'Datos de la unidad no válidos.'}, {status: 400});
    const item = parse.data;

    if (item.id) {
      const {data, error} = await supabase.from('inventory_items').update({
        sublocation: item.sublocation, purchase_cost: item.purchase_cost, estimated_value: item.estimated_value,
        item_code: item.item_code,
        name: item.name,
        size: item.size,
        condition: item.condition,
        status: item.status,
        location: item.location,
        purchase_or_build_date: item.purchase_or_build_date,
        production_cost: item.production_cost,
        replacement_value: item.replacement_value,
        main_image: item.main_image,
        notes: item.notes,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id).eq('organization_id', orgId).select().single();
      if (error) return NextResponse.json({error: error.message}, {status: 500});
      return NextResponse.json({data});
    } else {
      const {data, error} = await supabase.from('inventory_items').insert({
        organization_id: orgId,
        concept_id: item.concept_id,
        sublocation: item.sublocation, purchase_cost: item.purchase_cost, estimated_value: item.estimated_value,
        item_code: item.item_code,
        name: item.name,
        size: item.size,
        condition: item.condition,
        status: item.status,
        location: item.location || 'Ibiza Warehouse',
        purchase_or_build_date: item.purchase_or_build_date,
        production_cost: item.production_cost,
        replacement_value: item.replacement_value,
        main_image: item.main_image,
        notes: item.notes,
      }).select().single();
      if (error) return NextResponse.json({error: error.message}, {status: 500});
      return NextResponse.json({data});
    }
  }

  if (action === 'saveRepair') {
    const parse = repairSchema.safeParse(body.repair);
    if (!parse.success) return NextResponse.json({error: 'Datos de la reparación no válidos.'}, {status: 400});
    const rep = parse.data;

    if (rep.id) {
      const {data, error} = await supabase.from('inventory_repairs').update({
        incident_type: rep.incident_type,
        problem: rep.problem,
        status: rep.status,
        estimated_cost: rep.estimated_cost,
        actual_cost: rep.actual_cost,
        assigned_to: rep.assigned_to,
        date_completed: rep.date_completed,
        before_image: rep.before_image,
        after_image: rep.after_image,
        notes: rep.notes,
        updated_at: new Date().toISOString(),
      }).eq('id', rep.id).eq('organization_id', orgId).select().single();
      if (error) return NextResponse.json({error: error.message}, {status: 500});

      return NextResponse.json({data});
    } else {
      const {data, error} = await supabase.from('inventory_repairs').insert({
        organization_id: orgId,
        inventory_item_id: rep.inventory_item_id,
        date_reported: rep.date_reported || new Date().toISOString().slice(0, 10),
        incident_type: rep.incident_type,
        problem: rep.problem,
        status: rep.status,
        estimated_cost: rep.estimated_cost,
        actual_cost: rep.actual_cost,
        assigned_to: rep.assigned_to,
        date_completed: rep.date_completed,
        before_image: rep.before_image,
        after_image: rep.after_image,
        notes: rep.notes,
      }).select().single();
      if (error) return NextResponse.json({error: error.message}, {status: 500});

      return NextResponse.json({data});
    }
  }

  if (action === 'allocateToEvent') {
    const parse = allocationSchema.safeParse(body.allocation);
    if (!parse.success) return NextResponse.json({error: 'Datos de asignación no válidos.'}, {status: 400});
    const alloc = parse.data;

    const {data, error} = await supabase.rpc('save_inventory_allocation', {target_org: orgId, payload: alloc});
    if (error) return NextResponse.json({error: error.message}, {status: 409});
    return NextResponse.json({data});
  }

  if (action === 'deleteAllocation') {
    const parsed = z.string().uuid().safeParse(body.id);
    if (!parsed.success) return NextResponse.json({error: 'ID no válido.'}, {status: 400});
    const {data: allocation, error: readError} = await supabase.from('inventory_event_allocations')
      .select('*').eq('id', parsed.data).eq('organization_id', orgId).single();
    if (readError || !allocation) return NextResponse.json({error: 'Asignación no encontrada.'}, {status: 404});
    const {error} = await supabase.rpc('save_inventory_allocation', {target_org: orgId, payload: {...allocation, status: 'CANCELLED'}});
    if (error) return NextResponse.json({error: error.message}, {status: 409});
    return NextResponse.json({ok: true});
  }

  return NextResponse.json({error: 'Acción no reconocida.'}, {status: 400});
}
