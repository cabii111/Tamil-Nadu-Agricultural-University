/**
 * EDII-MAFBIF — Supabase Client Configuration
 * Pure Vanilla JavaScript Client for Browser Environments
 * 
 * IMPORTANT:
 * - Uses only the public/anon (publishable) API key.
 * - NEVER use or expose the Supabase secret/service-role key in client-side code.
 */

// Supabase Configuration Placeholders
const SUPABASE_URL = "https://hxagutcwfgdzbpsehphi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_AxT56CezCa5BMqLk0CI0dg_Xmq_sFC4";

// Initialize Supabase client
let supabaseClient = null;

if (typeof window !== 'undefined' && window.supabase) {
  if (SUPABASE_URL !== "PASTE_PROJECT_URL_HERE" && SUPABASE_PUBLISHABLE_KEY !== "PASTE_PUBLISHABLE_KEY_HERE") {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
      console.log('[Supabase] Client initialized successfully.');
    } catch (err) {
      console.error('[Supabase] Initialization error:', err);
    }
  } else {
    console.info('[Supabase] Awaiting project credentials. Update SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in /js/supabase-client.js.');
  }
} else {
  console.warn('[Supabase] CDN library not detected. Ensure @supabase/supabase-js is loaded before /js/supabase-client.js.');
}

// Expose on global window object for browser access
if (typeof window !== 'undefined') {
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;
  window.supabaseClient = supabaseClient;
}
