
const supabase = require('./db');

async function checkSchema() {
    try {
        console.log("Checking locomotive_remarks schema...");
        const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'locomotive_remarks' });
        if (error) {
            console.log("RPC get_table_columns failed, trying direct select...");
            const { data: selectData, error: selectError } = await supabase
                .from('locomotive_remarks')
                .select('*')
                .limit(1);
            
            if (selectError) {
                console.error("Select failed:", selectError);
            } else {
                console.log("Columns found via select:", Object.keys(selectData[0] || {}));
            }
        } else {
            console.log("Columns via RPC:", data);
        }

        console.log("\nChecking if increment_template_usage exists...");
        const { data: rpcCheck, error: rpcError } = await supabase.rpc('increment_template_usage', { t_id: 1 });
        if (rpcError) {
            console.error("RPC increment_template_usage failed:", rpcError);
        } else {
            console.log("RPC increment_template_usage exists!");
        }
    } catch (err) {
        console.error("Check failed:", err);
    }
}

checkSchema();
