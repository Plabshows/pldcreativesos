import {beforeEach, describe, expect, it, vi} from 'vitest';

const state = vi.hoisted(() => ({ organization: 'workspace-a', denied: false, queries: [] as {filters: [string, unknown][]}[] }));
vi.mock('@/lib/server/auth', () => ({requireOrganization: async () => {
  if (state.denied) return {error: new Response(null, {status: 401})};
  return {membership: {organization_id: state.organization}, supabase: {from: () => {
    const record = {filters: [] as [string, unknown][]}; state.queries.push(record);
    const query = {
      select: () => query, is: () => query, neq: () => query,
      order: () => query, limit: () => query, ilike: () => query,
      eq: (field: string, value: unknown) => {record.filters.push([field, value]); return query;},
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({data: [], error: null}).then(resolve),
    }; return query;
  }}};
}}));
import {GET as clients} from '@/app/api/clients/route';
import {GET as events} from '@/app/api/events/route';
import {GET as tasks} from '@/app/api/tasks/route';

describe('Legacy routes respect the selected workspace', () => {
  beforeEach(() => {state.queries = []; state.denied = false;});
  for (const [name, get] of [['clients', () => clients(new Request('http://localhost/api/clients'))], ['events', events], ['tasks', tasks]] as const) {
    it(`${name}: applies the active organization to the database query`, async () => {
      for (const org of ['workspace-a', 'workspace-b']) {
        state.organization = org;
        expect((await get())?.status).toBe(200);
        expect(state.queries.at(-1)?.filters).toContainEqual(['organization_id', org]);
      }
    });
    it(`${name}: never queries business data without authentication`, async () => {
      state.denied = true;
      expect((await get())?.status).toBe(401);
      expect(state.queries).toHaveLength(0);
    });
  }
});
