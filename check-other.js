const supabase = require('./db');

async function checkOtherAdmin() {
    const { data, error } = await supabase
        .from('users')
        .select('id, username, role, is_global_admin, location_id')
        .eq('username', 'sailau.ali')
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('User data:', JSON.stringify(data, null, 2));
}

checkOtherAdmin();
