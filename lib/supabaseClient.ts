import { createClient } from '@supabase/supabase-js';

// Helper to get env variable from Vite, Next.js, or standard React
const getEnv = (key: string, viteKey: string) => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[viteKey]) {
    // @ts-ignore
    return import.meta.env[viteKey];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || process.env[viteKey];
  }
  return '';
};

const ENV_SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
const ENV_SUPABASE_ANON_KEY = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');

let client;

if (!ENV_SUPABASE_URL || !ENV_SUPABASE_ANON_KEY) {
  console.error('🔴 CRITICAL: Supabase credentials missing! Please check your .env file or Netlify Environment Variables.');
  
  // Create a dummy client with a placeholder URL to prevent "Uncaught Error: supabaseUrl is required"
  // This allows the UI to render (and show empty states) instead of crashing entirely.
  client = createClient('https://placeholder-project.supabase.co', 'placeholder-key');
} else {
  client = createClient(ENV_SUPABASE_URL, ENV_SUPABASE_ANON_KEY);
}

export const supabase = client;