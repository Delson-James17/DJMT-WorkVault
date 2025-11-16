import { createClient } from '@supabase/supabase-js';

// Environment variables (must start with VITE_ in Vite)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Export a single initialized client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
