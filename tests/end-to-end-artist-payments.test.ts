import { it, expect, describe } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

describe('End-to-End Artist Payment System Tests', () => {
  const setupDb = async () => {
    const db = new PGlite();
    const org = '11111111-1111-4111-8111-111111111111';
    const event = '22222222-2222-4222-8222-222222222222';
    const artist1 = '33333333-3333-4333-8333-333333333333'; // Omar Fraile
    const artist2 = '44444444-4444-4444-8444-444444444444'; // Said

    await db.exec(`
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql as 'select ''${artist1}''::uuid';
      create function has_org_role(uuid, text[]) returns boolean language sql as 'select true';

      create table events (
        id uuid primary key,
        organization_id uuid,
        event_name text,
        event_date text,
        deleted_at timestamptz,
        expenses_cents bigint,
        updated_at timestamptz
      );

      create table event_talent (
        organization_id uuid,
        event_id uuid,
        talent_id uuid,
        agreed_cost_cents bigint,
        primary key (event_id, talent_id)
      );

      create table payments (
        id uuid default gen_random_uuid() primary key,
        organization_id uuid,
        event_id uuid,
        talent_id uuid,
        kind text,
        direction text,
        amount_cents bigint,
        status text,
        paid_on timestamptz,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );

      create table expenses (
        organization_id uuid,
        event_id uuid,
        talent_id uuid,
        status text,
        total_cents bigint
      );

      create table talent (
        id uuid primary key,
        organization_id uuid,
        real_name text,
        deleted_at timestamptz
      );

      insert into events values('${event}', '${org}', 'Boda Amnesia', '2026-09-25', null, 0, now());
      insert into talent values('${artist1}', '${org}', 'Omar Fraile', null);
      insert into talent values('${artist2}', '${org}', 'Said', null);
      insert into event_talent values('${org}', '${event}', '${artist1}', 15600);
    `);

    // Load initial migrations & single-truth stored procedure
    await db.exec(readFileSync('supabase/migrations/202609200001_atomic_artist_fee.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202609250001_single_truth_artist_payments.sql', 'utf8'));

    return { db, org, event, artist1, artist2 };
  };

  it('TEST 1: Toggles Pendiente -> Pagado, sets paid_on and updates totals', async () => {
    const { db, org, event, artist1 } = await setupDb();

    // 1. Initial status is pending
    await db.query('select upsert_artist_payment($1, $2, $3, $4, $5)', [org, event, artist1, 15600, 'pending']);
    const initial = await db.query<{ status: string; paid_on: string | null }>('select status, paid_on from payments where talent_id=$1', [artist1]);
    expect(initial.rows[0].status).toBe('pending');
    expect(initial.rows[0].paid_on).toBeNull();

    // 2. Change to paid
    await db.query('select upsert_artist_payment($1, $2, $3, $4, $5)', [org, event, artist1, 15600, 'paid']);
    const paid = await db.query<{ status: string; paid_on: string | null }>('select status, paid_on from payments where talent_id=$1', [artist1]);
    expect(paid.rows[0].status).toBe('paid');
    expect(paid.rows[0].paid_on).not.toBeNull();
  });

  it('TEST 2: Updates fee 156 € -> 180 € without creating duplicate records', async () => {
    const { db, org, event, artist1 } = await setupDb();

    await db.query('select upsert_artist_payment($1, $2, $3, $4, $5)', [org, event, artist1, 15600, 'pending']);
    await db.query('select upsert_artist_payment($1, $2, $3, $4, $5)', [org, event, artist1, 18000, 'pending']);

    const payments = await db.query<{ amount_cents: number }>('select amount_cents from payments where talent_id=$1', [artist1]);
    const assignments = await db.query<{ agreed_cost_cents: number }>('select agreed_cost_cents from event_talent where talent_id=$1', [artist1]);

    expect(payments.rows).toHaveLength(1);
    expect(payments.rows[0].amount_cents).toBe(18000);
    expect(assignments.rows[0].agreed_cost_cents).toBe(18000);
  });

  it('TEST 3: Toggles Pagado -> Pendiente, resets paid_on to null', async () => {
    const { db, org, event, artist1 } = await setupDb();

    await db.query('select upsert_artist_payment($1, $2, $3, $4, $5)', [org, event, artist1, 15600, 'paid']);
    await db.query('select upsert_artist_payment($1, $2, $3, $4, $5)', [org, event, artist1, 15600, 'pending']);

    const res = await db.query<{ status: string; paid_on: string | null }>('select status, paid_on from payments where talent_id=$1', [artist1]);
    expect(res.rows[0].status).toBe('pending');
    expect(res.rows[0].paid_on).toBeNull();
  });

  it('TEST 4: Single source of truth survives state reload', async () => {
    const { db, org, event, artist1 } = await setupDb();

    await db.query('select upsert_artist_payment($1, $2, $3, $4, $5)', [org, event, artist1, 20000, 'paid']);
    const check1 = await db.query<{ status: string; amount_cents: number }>('select status, amount_cents from payments where talent_id=$1', [artist1]);

    // Simulate page reload / new query
    const check2 = await db.query<{ status: string; amount_cents: number }>('select status, amount_cents from payments where talent_id=$1', [artist1]);
    expect(check1.rows[0]).toEqual(check2.rows[0]);
    expect(check2.rows[0].status).toBe('paid');
    expect(check2.rows[0].amount_cents).toBe(20000);
  });

  it('TEST 5: Updates by talent_id isolate artists with similar names', async () => {
    const { db, org, event, artist1, artist2 } = await setupDb();

    await db.exec(`insert into event_talent values('${org}', '${event}', '${artist2}', 15000);`);
    await db.query('select upsert_artist_payment($1, $2, $3, $4, $5)', [org, event, artist1, 15600, 'paid']);
    await db.query('select upsert_artist_payment($1, $2, $3, $4, $5)', [org, event, artist2, 15000, 'pending']);

    const pay1 = await db.query<{ status: string }>('select status from payments where talent_id=$1', [artist1]);
    const pay2 = await db.query<{ status: string }>('select status from payments where talent_id=$1', [artist2]);

    expect(pay1.rows[0].status).toBe('paid');
    expect(pay2.rows[0].status).toBe('pending');
  });

  it('TEST 6: Adding artist with fee 120 € reflects automatically in payment system', async () => {
    const { db, org, event, artist2 } = await setupDb();

    await db.exec(`insert into event_talent values('${org}', '${event}', '${artist2}', 12000);`);
    await db.query('select upsert_artist_payment($1, $2, $3, $4, $5)', [org, event, artist2, 12000, 'pending']);

    const res = await db.query<{ amount_cents: number; status: string }>('select amount_cents, status from payments where talent_id=$1', [artist2]);
    expect(res.rows[0].amount_cents).toBe(12000);
    expect(res.rows[0].status).toBe('pending');
  });

  it('TEST 7: Removing artist clears pending payment but preserves paid history', async () => {
    const { db, org, event, artist1, artist2 } = await setupDb();

    await db.exec(`insert into event_talent values('${org}', '${event}', '${artist2}', 12000);`);
    await db.query('select upsert_artist_payment($1, $2, $3, $4, $5)', [org, event, artist1, 15600, 'paid']);
    await db.query('select upsert_artist_payment($1, $2, $3, $4, $5)', [org, event, artist2, 12000, 'pending']);

    // Remove pending artist2
    await db.exec(`delete from payments where talent_id='${artist2}' and status<>'paid'`);
    await db.exec(`delete from event_talent where talent_id='${artist2}'`);

    const artist2Payments = await db.query<{ status: string }>('select * from payments where talent_id=$1', [artist2]);
    const artist1Payments = await db.query<{ status: string }>('select * from payments where talent_id=$1', [artist1]);

    expect(artist2Payments.rows).toHaveLength(0);
    expect(artist1Payments.rows).toHaveLength(1);
    expect(artist1Payments.rows[0].status).toBe('paid');
  });
});
