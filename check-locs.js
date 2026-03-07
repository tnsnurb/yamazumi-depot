const supabase = require('./db');

async function checkLocations() {
    const { data, error } = await supabase.from('locations').select('*');
    if (error) {
        console.error('Error fetching locations:', error);
        return;
    }
    console.log('Locations found:', JSON.stringify(data, null, 2));
}

checkLocations();
