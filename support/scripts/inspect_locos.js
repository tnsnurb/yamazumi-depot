const supabase = require('./db');

async function inspectLocos() {
    console.log('Fetching all locomotives...');
    const { data, error } = await supabase
        .from('locomotives')
        .select('*');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data.length} locomotives.`);
    data.forEach(l => {
        console.log(`[${l.id}] ${l.series} ${l.number} | status: ${l.status} | location: ${l.location_id} | track: ${l.track} | pos: ${l.position}`);
    });
}

inspectLocos();
