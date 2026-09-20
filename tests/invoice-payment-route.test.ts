import {describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({insert:vi.fn()}));
vi.mock('@/lib/server/auth',()=>({requireOrganization:async()=>({membership:{organization_id:'org',role:'admin'},userId:'user',supabase:{from:state.insert}})}));
import {POST} from '@/app/api/invoices/route';
const id='81a72d11-a542-4cbe-bb24-1e23b40c9e9a';
describe('Receipt registration',()=>{
 it('rejects the old paid shortcut without touching the database',async()=>{state.insert.mockClear();const r=await POST(new Request('http://localhost/api/invoices',{method:'POST',body:JSON.stringify({action:'mark_paid',id})}));expect(r?.status).toBe(409);expect(state.insert).not.toHaveBeenCalled();});
 it('requires a payment method before any write',async()=>{state.insert.mockClear();const r=await POST(new Request('http://localhost/api/invoices',{method:'POST',body:JSON.stringify({action:'payment',id,invoice_id:id,payment_date:'2026-09-20',amount_cents:100,currency:'EUR',method:' ',reference:'',note:''})}));expect(r?.status).toBe(400);expect(state.insert).not.toHaveBeenCalled();});
});
