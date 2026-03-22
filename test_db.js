require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

console.log('Testing connection to:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('Querying users...');
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Success! Count result:', data);
    }
    process.exit(error ? 1 : 0);
}

test().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
