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
});

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  concept_id: z.string().uuid(),
  item_code: z.string().trim().min(1).max(100),
  name: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  condition: z.enum(['NEW', 'EXCELLENT', 'GOOD', 'USED', 'DAMAGED']).default('GOOD'),
  status: z.enum(['AVAILABLE', 'RESERVED', 'OUT', 'REPAIR', 'CLEANING', 'LOST', 'RETIRED']).default('AVAILABLE'),
  location: z.string().nullable().optional(),
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

  const concepts = conceptsRes.data || [];
  const items = itemsRes.data || [];
  const repairs = repairsRes.data || [];
  const allocations = allocationsRes.data || [];
  const events = eventsRes.data || [];

  const totalConcepts = concepts.length;
  const totalUnits = items.filter(i => i.status !== 'RETIRED').length;
  const availableUnits = items.filter(i => i.status === 'AVAILABLE').length;
  const reservedUnits = items.filter(i => i.status === 'RESERVED').length;
  const outUnits = items.filter(i => i.status === 'OUT').length;
  const repairUnits = items.filter(i => i.status === 'REPAIR').length;
  const cleaningUnits = items.filter(i => i.status === 'CLEANING').length;
  const lostUnits = items.filter(i => i.status === 'LOST').length;

  const totalInventoryValue = concepts.reduce((acc, c) => acc + (c.replacement_value || c.production_cost || 0) * (c.total_units || 0), 0);
  const totalRepairCost = repairs.reduce((acc, r) => acc + (r.actual_cost || r.estimated_cost || 0), 0);

  const attentionItems = items.filter(i => ['REPAIR', 'CLEANING', 'LOST'].includes(i.status) || !i.location || i.condition === 'DAMAGED').map(i => {
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
      issue: i.status === 'REPAIR' ? `Reparación: ${activeRepair?.problem || 'Pendiente'}` : i.status === 'CLEANING' ? 'Limpieza pendiente' : i.status === 'LOST' ? 'Unidad perdida' : !i.location ? 'Sin ubicación asignada' : 'Dañado',
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

      if (['PENDING', 'IN_PROGRESS'].includes(rep.status)) {
        await supabase.from('inventory_items').update({status: 'REPAIR', location: 'Taller / Reparación'}).eq('id', rep.inventory_item_id).eq('organization_id', orgId);
      } else if (rep.status === 'DONE') {
        await supabase.from('inventory_items').update({status: 'AVAILABLE', location: 'Ibiza Warehouse'}).eq('id', rep.inventory_item_id).eq('organization_id', orgId);
      }

      return NextResponse.json({data});
    } else {
      const {data, error} = await supabase.from('inventory_repairs').insert({
        organization_id: orgId,
        inventory_item_id: rep.inventory_item_id,
        date_reported: rep.date_reported || new Date().toISOString().slice(0, 10),
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

      if (['PENDING', 'IN_PROGRESS'].includes(rep.status)) {
        await supabase.from('inventory_items').update({status: 'REPAIR', location: 'Taller / Reparación'}).eq('id', rep.inventory_item_id).eq('organization_id', orgId);
      }

      return NextResponse.json({data});
    }
  }

  if (action === 'allocateToEvent') {
    const parse = allocationSchema.safeParse(body.allocation);
    if (!parse.success) return NextResponse.json({error: 'Datos de asignación no válidos.'}, {status: 400});
    const alloc = parse.data;

    const {data: targetEvent} = await supabase.from('events').select('id, event_name, event_date').eq('id', alloc.event_id).eq('organization_id', orgId).single();
    if (!targetEvent) return NextResponse.json({error: 'Evento no encontrado.'}, {status: 404});

    const {data: concept} = await supabase.from('inventory_concepts').select('id, name, total_units').eq('id', alloc.concept_id).eq('organization_id', orgId).single();
    if (!concept) return NextResponse.json({error: 'Concepto de inventario no encontrado.'}, {status: 404});

    const {data: physicalItems} = await supabase.from('inventory_items').select('id, status').eq('concept_id', alloc.concept_id).eq('organization_id', orgId);
    const availableCount = (physicalItems || []).filter(i => ['AVAILABLE', 'RESERVED'].includes(i.status)).length;
    const requested = alloc.quantity;

    let warning: string | null = null;
    let conflict = false;

    if (targetEvent.event_date) {
      const {data: overlappingEvents} = await supabase.from('events').select('id').eq('organization_id', orgId).eq('event_date', targetEvent.event_date).is('deleted_at', null);
      const overlappingIds = (overlappingEvents || []).map(e => e.id);

      if (overlappingIds.length > 0) {
        const {data: activeAllocations} = await supabase.from('inventory_event_allocations').select('quantity').eq('organization_id', orgId).eq('concept_id', alloc.concept_id).in('event_id', overlappingIds).neq('status', 'CANCELLED');
        const alreadyAllocated = (activeAllocations || []).reduce((sum, a) => sum + (a.quantity || 1), 0);
        const totalNeeded = alreadyAllocated + requested;

        if (totalNeeded > availableCount) {
          conflict = true;
          warning = `⚠ ALERTA DE CONFLICTO: ${concept.name} (${availableCount} disponibles / ${totalNeeded} necesarias para la fecha ${targetEvent.event_date}).`;
        }
      }
    } else if (requested > availableCount) {
      conflict = true;
      warning = `⚠ ALERTA DE CONFLICTO: ${concept.name} (${availableCount} disponibles / ${requested} necesarias).`;
    }

    if (alloc.id) {
      const {data, error} = await supabase.from('inventory_event_allocations').update({
        quantity: alloc.quantity,
        inventory_item_id: alloc.inventory_item_id,
        status: alloc.status,
        rental_revenue: alloc.rental_revenue,
        notes: alloc.notes,
        updated_at: new Date().toISOString(),
      }).eq('id', alloc.id).eq('organization_id', orgId).select().single();
      if (error) return NextResponse.json({error: error.message}, {status: 500});

      if (alloc.inventory_item_id) {
        if (alloc.status === 'OUT') {
          await supabase.from('inventory_items').update({status: 'OUT', location: 'Evento', last_event_id: alloc.event_id, last_used_at: new Date().toISOString()}).eq('id', alloc.inventory_item_id).eq('organization_id', orgId);
        } else if (alloc.status === 'RETURNED') {
          const nextStatus = alloc.return_item_status || 'AVAILABLE';
          await supabase.from('inventory_items').update({status: nextStatus, location: nextStatus === 'AVAILABLE' ? 'Ibiza Warehouse' : 'Taller / Reparación'}).eq('id', alloc.inventory_item_id).eq('organization_id', orgId);
        }
      }

      return NextResponse.json({data, conflict, warning});
    } else {
      const {data, error} = await supabase.from('inventory_event_allocations').insert({
        organization_id: orgId,
        event_id: alloc.event_id,
        concept_id: alloc.concept_id,
        inventory_item_id: alloc.inventory_item_id,
        quantity: alloc.quantity,
        status: alloc.status || 'RESERVED',
        rental_revenue: alloc.rental_revenue,
        notes: alloc.notes,
      }).select().single();
      if (error) return NextResponse.json({error: error.message}, {status: 500});

      if (alloc.inventory_item_id && alloc.status === 'OUT') {
        await supabase.from('inventory_items').update({status: 'OUT', location: 'Evento', last_event_id: alloc.event_id, last_used_at: new Date().toISOString()}).eq('id', alloc.inventory_item_id).eq('organization_id', orgId);
      }

      return NextResponse.json({data, conflict, warning});
    }
  }

  if (action === 'deleteAllocation') {
    const {id} = body;
    if (!id || typeof id !== 'string') return NextResponse.json({error: 'ID de asignación no válido.'}, {status: 400});
    const {error} = await supabase.from('inventory_event_allocations').delete().eq('id', id).eq('organization_id', orgId);
    if (error) return NextResponse.json({error: error.message}, {status: 500});
    return NextResponse.json({ok: true});
  }

  return NextResponse.json({error: 'Acción no reconocida.'}, {status: 400});
}
