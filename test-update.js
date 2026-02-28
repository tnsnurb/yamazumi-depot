require('dotenv').config();
const supabase = require('./db');

async function testUpdate() {
    console.log("Attempting to update location 1 with track_config...");
    const { data, error } = await supabase
        .from('locations')
        .update({ track_config: "1:TEST_ZONE,2:TEST_ZONE2" })
        .eq('id', 1)
        .select();

    console.log("Error:", error);
    console.log("Data returned:", data);

    // Also try to read it
    const { data: readData } = await supabase.from('locations').select('id, name, track_config').eq('id', 1);
    console.log("Read Data:", readData);
}

testUpdate();
