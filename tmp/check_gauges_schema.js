const supabase = require('../db');

async function checkGaugesSchema() {
    try {
        console.log("Checking gauges schema...");
        const { data, error } = await supabase
            .from('gauges')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error("Select failed:", error);
        } else {
            console.log("Columns in gauges table:", Object.keys(data[0] || {}));
        }

        console.log("\nChecking locomotives schema...");
        const { data: locoData, error: locoError } = await supabase
            .from('locomotives')
            .select('*')
            .limit(1);
        
        if (locoError) {
            console.error("Select failed:", locoError);
        } else {
            console.log("Columns in locomotives table:", Object.keys(locoData[0] || {}));
        }
    } catch (err) {
        console.error("Check failed:", err);
    }
}

checkGaugesSchema();
