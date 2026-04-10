const supabase = require('./db');

async function inspect() {
    try {
        const { data, error } = await supabase
            .from('locomotives')
            .select('number, acceptance_time')
            .limit(5);

        if (error) {
            console.error('Error fetching locomotives:', error);
            process.exit(1);
        }

        console.log('Sample locomotives data:', JSON.stringify(data, null, 2));

    } catch (err) {
        console.error('Unexpected error:', err);
        process.exit(1);
    }
}

inspect();
