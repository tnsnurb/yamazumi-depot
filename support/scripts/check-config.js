const supabase = require('./db');

async function checkConfig() {
    const { data, error } = await supabase.from('locations').select('id, name, track_config');
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Configs:', JSON.stringify(data, null, 2));
}

checkConfig();
