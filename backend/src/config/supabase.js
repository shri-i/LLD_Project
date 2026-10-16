const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env');
}
if (supabaseUrl.includes('your-project') || serviceRoleKey.startsWith('replace-with')) {
  throw new Error('backend/.env still has placeholder Supabase values; paste your project URL and service_role key');
}
if (serviceRoleKey.startsWith('sb_publishable_')) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is a publishable key; use the secret key (sb_secret_...) or the legacy service_role key (eyJ...)');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: { transport: WebSocket },
});

module.exports = supabase;
