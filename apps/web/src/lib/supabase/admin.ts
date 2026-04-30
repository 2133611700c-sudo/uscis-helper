// SERVER ONLY. DO NOT IMPORT IN CLIENT CODE.
import { createClient } from '@supabase/supabase-js';

export function createAdminSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
