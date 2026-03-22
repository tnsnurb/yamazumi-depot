const supabase = require('./db');

async function testGetAll() {
    const locationId = 1;
    console.log(`Testing query for location_id: ${locationId}`);
    
    const { data, error } = await supabase
        .from('locomotives')
        .select('*')
        .eq('location_id', locationId)
        .order('number', { ascending: true });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data.length} locomotives:`);
    data.forEach(l => {
        console.log(` - ${l.series} ${l.number} | Status: ${l.status} | Track: ${l.track} | Pos: ${l.position}`);
    });
}

testGetAll();
