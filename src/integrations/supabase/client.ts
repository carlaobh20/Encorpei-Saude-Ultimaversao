// Cliente Supabase — Encorpei Cardio.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/config';

export { SUPABASE_CONFIGURADO } from '@/lib/config';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    // Disabled globally — enable only on pages that require live sync (e.g. followup).
    // At 5k users, open WebSockets per user would exhaust connection limits.
    params: {
      eventsPerSecond: 2,
    },
  },
  global: {
    headers: {
      "x-app-version": "1.0.0",
    },
  },
});
