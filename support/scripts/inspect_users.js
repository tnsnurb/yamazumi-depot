require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('Fetching one user to see columns...');
    const { data, error } = await supabase.from('users').select('*').limit(1).single();
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Columns:', Object.keys(data));
        console.log('Full record sample:', data);
    }
    process.exit(0);
}
test();
