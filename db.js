require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to detect if we are getting blocked by a network filter (Cisco Umbrella, etc)
supabase.checkBlock = (error) => {
  if (!error) return false;
  const msg = error.message || String(error);
  if (msg.includes('fetch failed') || msg.toLowerCase().includes('<html>')) {
    return true;
  }
  return false;
};

module.exports = supabase;
