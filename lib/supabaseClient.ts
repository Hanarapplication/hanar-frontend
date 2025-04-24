import { createClient } from '@supabase/supabase-js'

// These are public and safe to expose in the browser
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a single supabase client for the whole frontend app
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
