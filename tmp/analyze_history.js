const supabase = require('../db');

async function analyzeGaugeHistory() {
    try {
        const { data: history, error } = await supabase
            .from('gauge_history')
            .select(`
                *,
                user:users!gauge_history_created_by_fkey(username, full_name, location_id),
                gauge:gauges(serial_number)
            `);
        
        if (error) throw error;

        console.log(`Total History Records: ${history.length}`);
        
        history.forEach(rec => {
            console.log(`Action: ${rec.action}, Gauge: ${rec.gauge?.serial_number}, User: ${rec.user?.full_name}, User Loc: ${rec.user?.location_id}`);
        });

    } catch (err) {
        console.error("History analysis failed:", err);
    }
}

analyzeGaugeHistory();
