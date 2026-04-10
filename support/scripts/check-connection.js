const supabase = require('./db');

async function check() {
    try {
        console.log('Checking Supabase connection...');
        const { data, error } = await supabase.from('locations').select('name').limit(1);

        if (error) {
            console.error('❌ Connection failed:', error.message);
            process.exit(1);
        }

        console.log('✅ Connection successful. Found location:', data[0]?.name || 'No locations found');
        process.exit(0);

    } catch (err) {
        console.error('❌ Unexpected error:', err.message);
        process.exit(1);
    }
}

check();
