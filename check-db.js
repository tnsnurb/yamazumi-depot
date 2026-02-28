const supabase = require('./db');

async function fix() {
    try {
        const { data, error } = await supabase
            .from('movements')
            .update({ location_id: 1 })
            .is('location_id', null)
            .select();

        if (error) {
            console.error('Error:', error);
            process.exit(1);
        }

        console.log('Fixed movements:', data.length);

    } catch (err) {
        console.error('Unexpected error:', err);
        process.exit(1);
    }
}

fix();
