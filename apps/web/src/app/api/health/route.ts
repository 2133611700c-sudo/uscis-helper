import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-health-token');
  if (!token || token !== process.env.HEALTH_TOKEN) {
    return new NextResponse(null, { status: 404 });
  }

  let dbOk = false;
  try {
    const db = createAdminSupabaseClient();
    // Query audit_log (guaranteed to exist) rather than a specific table
    const { error } = await db.from('audit_log').select('id', { count: 'exact', head: true });
    dbOk = !error;
  } catch {
    dbOk = false;
  }

  return NextResponse.json({ ok: true, db: dbOk, ts: new Date().toISOString() });
}
