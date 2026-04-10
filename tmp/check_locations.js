const supabase = require('../db');

async function checkLocations() {
    try {
        console.log("Checking locations...");
        const { data, error } = await supabase
            .from('locations')
            .select('*');
        
        if (error) {
            console.error("Select failed:", error);
        } else {
            console.log("Locations:", data);
        }
    } catch (err) {
        console.error("Check failed:", err);
    }
}

checkLocations();
