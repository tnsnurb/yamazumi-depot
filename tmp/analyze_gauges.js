const supabase = require('../db');

async function analyzeGaugeDistribution() {
    try {
        const { data: gauges, error } = await supabase
            .from('gauges')
            .select('id, serial_number, status, locomotive_id, lat, lng, locomotives(location_id)');
        
        if (error) throw error;

        console.log(`Total Gauges: ${gauges.length}`);
        
        const onLoco = gauges.filter(g => g.locomotive_id);
        console.log(`Gauges on Locomotives: ${onLoco.length}`);
        
        const locCounts = {};
        onLoco.forEach(g => {
            const locId = g.locomotives?.location_id || 'unknown';
            locCounts[locId] = (locCounts[locId] || 0) + 1;
        });
        console.log("Distribution by Locomotive Location:", locCounts);

        const inWarehouse = gauges.filter(g => !g.locomotive_id);
        console.log(`Gauges in Warehouse/Verification: ${inWarehouse.length}`);
        
        const withCoords = inWarehouse.filter(g => g.lat && g.lng);
        console.log(`Gauges in Warehouse with coords: ${withCoords.length}`);
        if (withCoords.length > 0) {
            console.log("Sample coords:", withCoords.slice(0, 3).map(g => ({lat: g.lat, lng: g.lng})));
        }

    } catch (err) {
        console.error("Analysis failed:", err);
    }
}

analyzeGaugeDistribution();
