require('dotenv').config();
const supabase = require('./db');

async function check() {
    console.log('--- Checking Supabase Connection ---');
    try {
        const { data: catalog, error: catalogError } = await supabase.from('locomotive_catalog').select('*').limit(1);
        if (catalogError) {
            console.error('❌ catalog error:', catalogError.message);
        } else {
            console.log('✅ catalog ok');
        }

        const { data: users, error: usersError } = await supabase.from('users').select('*').limit(1);
        if (usersError) {
            console.error('❌ users error:', usersError.message);
        } else {
            console.log('✅ users ok');
        }

        const { data: locomotives, error: locoError } = await supabase.from('locomotives').select('*').limit(1);
        if (locoError) {
            console.error('❌ locomotives error:', locoError.message);
        } else {
            console.log('✅ locomotives ok');
        }
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
    }
}

check();
