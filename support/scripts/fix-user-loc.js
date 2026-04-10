const supabase = require('./db');

async function fixUserLocation() {
    const { data, error } = await supabase
        .from('users')
        .update({ location_id: 2 })
        .eq('username', 'tnsnurb@gmail.com')
        .select();

    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('User location updated:', data);
}

fixUserLocation();
