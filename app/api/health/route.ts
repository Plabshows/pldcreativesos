import { NextResponse } from 'next/server';
import { hasSupabaseConfig } from '@/lib/env';

export async function GET() {
  return NextResponse.json({ service: 'performance-lab-os', status: 'ok', supabaseConfigured: hasSupabaseConfig(), timestamp: new Date().toISOString() });
}
