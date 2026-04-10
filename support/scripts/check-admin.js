const supabase = require('./db');

async function checkAdmin() {
    const { data, error } = await supabase
        .from('users')
        .select('id, username, role, is_global_admin, location_id')
        .eq('username', 'tnsnurb@gmail.com')
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('User data:', JSON.stringify(data, null, 2));
}

checkAdmin();
