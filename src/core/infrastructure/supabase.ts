import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config';

/**
 * The one connection to the backend (HTTPS, RNF-002). The key is the publishable one: what each
 * user can reach is enforced by the database's row level security.
 */
export const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // E-mail links carry the tokens, so a link opened from any browser on the phone works.
    flowType: 'implicit',
  },
});
