import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nwqceiskkirunbpzlgzy.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cWNlaXNra2lydW5icHpsZ3p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NjUzOTcsImV4cCI6MjA4NzE0MTM5N30.Omim73XUONBeUKiZKAF4EgCfH3LBen-oNeAsE16WYTA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
