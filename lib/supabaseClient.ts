import { createClient } from '@supabase/supabase-js';

// Ganti dengan URL dan Key dari Project Settings > API di Dashboard Supabase Anda
// Dalam production, gunakan process.env.VITE_SUPABASE_URL dll.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);