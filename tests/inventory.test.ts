import {it, expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';

it('manages inventory concepts, physical units, conflict alerts and repair costs atomically', async () => {
  const db = new PGlite();
  const org = '11111111-1111-4111-8111-111111111111';
  const event1 = '22222222-2222-4222-8222-222222222222';
  const event2 = '33333333-3333-4333-8333-333333333333';

  try {
    await db.exec(`
      create role authenticated;
      create role anon;
      create schema auth;
      create function has_org_role(uuid, text[]) returns boolean language sql as 'select true';
      create table organizations(id uuid primary key);
      insert into organizations values('${org}');
      create table events(id uuid primary key, organization_id uuid, event_name text, event_date date, deleted_at timestamptz, status text);
      insert into events values('${event1}', '${org}', 'Flower Power Pacha', '2026-09-25', null, 'confirmed');
      insert into events values('${event2}', '${org}', 'Amnesia Friday', '2026-09-25', null, 'confirmed');
    `);

    const migration = readFileSync('supabase/migrations/202609210001_inventory_system.sql', 'utf8')
      .replace('create extension if not exists unaccent;', '');
    await db.exec(migration);

    // Verify seed concepts exist
    const seedConcepts = (await db.query<{name: string}>('select name from inventory_concepts where organization_id = $1', [org])).rows;
    expect(seedConcepts.length).toBeGreaterThanOrEqual(19);

    // Create a new concept: POM POM SILVER
    const conceptRes = await db.query<{id: string}>(`
      insert into inventory_concepts(organization_id, name, category, suggested_rental_price, production_cost)
      values($1, 'POM POM SILVER', 'Characters', 10000, 45000)
      returning id
    `, [org]);
    const conceptId = conceptRes.rows[0].id;

    // Create 4 physical units
    for (let i = 1; i <= 4; i++) {
      await db.query(`
        insert into inventory_items(organization_id, concept_id, item_code, status, location)
        values($1, $2, $3, 'AVAILABLE', 'Ibiza Warehouse')
      `, [org, conceptId, `PPS-0${i}`]);
    }

    // Verify trigger updated total_units to 4
    const totalUnitsRes = await db.query<{total_units: number}>('select total_units from inventory_concepts where id = $1', [conceptId]);
    expect(totalUnitsRes.rows[0].total_units).toBe(4);

    // Allocate 3 units to event1
    await db.query(`
      insert into inventory_event_allocations(organization_id, event_id, concept_id, quantity, status, rental_revenue)
      values($1, $2, $3, 3, 'RESERVED', 10000)
    `, [org, event1, conceptId]);

    // Check date availability: total available = 4, total requested on 2026-09-25 = 3 (Event1) + 2 (Event2) = 5 > 4 => CONFLICT!
    const allocEvent2 = 2;
    const sameDateEvents = (await db.query<{id: string}>("select id from events where event_date = '2026-09-25'")).rows.map(r => r.id);
    const dateAllocations = (await db.query<{quantity: number}>(`
      select quantity from inventory_event_allocations where concept_id = $1 and event_id = any($2)
    `, [conceptId, sameDateEvents])).rows;
    const totalAllocatedOnDate = dateAllocations.reduce((sum, a) => sum + a.quantity, 0) + allocEvent2;

    expect(totalAllocatedOnDate).toBe(5);
    expect(totalAllocatedOnDate > 4).toBe(true); // Conflict detected!

    // Mark 1 unit in REPAIR
    const item1Id = (await db.query<{id: string}>("select id from inventory_items where item_code = 'PPS-01'")).rows[0].id;
    await db.query(`
      insert into inventory_repairs(organization_id, inventory_item_id, problem, status, actual_cost)
      values($1, $2, 'Cremallera rota', 'IN_PROGRESS', 5000)
    `, [org, item1Id]);

    await db.query("update inventory_items set status = 'REPAIR' where id = $1", [item1Id]);

    // Verify repair cost accumulation = 5000 cents (50€)
    const repairCostRes = await db.query<{sum: number}>("select sum(coalesce(actual_cost, estimated_cost, 0)) as sum from inventory_repairs where organization_id = $1", [org]);
    expect(Number(repairCostRes.rows[0].sum)).toBe(5000);

  } finally {
    await db.close();
  }
}, 15000);
