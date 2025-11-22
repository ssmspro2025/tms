import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://msekkmxlrqnolbxqgznz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_sJw8-3dUJU9xG0M-evE8vg_EivNGMB4';

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('Supabase credentials are missing');
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'X-Client-Info': '@supabase/supabase-js'
    }
  }
});
