const supabase = require('../db');

async function checkGaugesAllColumns() {
    try {
        // Try to get one row and its columns, even if some are null
        const { data, error } = await supabase
            .from('gauges')
            .select('*');
        
        if (error) {
            console.error("Select failed:", error);
        } else if (data.length > 0) {
            // Check all keys across all rows just in case some are null in some rows
            const allKeys = new Set();
            data.forEach(row => Object.keys(row).forEach(key => allKeys.add(key)));
            console.log("All columns in gauges table:", Array.from(allKeys));
            
            // Also check a few rows to see if location_id is present
            console.log("First 3 rows (partial):", data.slice(0, 3).map(r => ({id: r.id, serial: r.serial_number, loc_id: r.location_id, status: r.status})));
        } else {
            console.log("No gauges found.");
        }
    } catch (err) {
        console.error("Check failed:", err);
    }
}

checkGaugesAllColumns();
