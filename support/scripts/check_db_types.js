
const supabase = require('./db');

async function checkTypes() {
    const tables = ['users', 'locomotives', 'locomotive_remarks', 'repair_sessions'];
    for (const table of tables) {
        console.log(`\nChecking column types for table: ${table}`);
        const { data, error } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type')
            .eq('table_name', table)
            .eq('table_schema', 'public');
            
        if (error) {
            console.error(`Error checking ${table}:`, error);
        } else {
            data.forEach(c => {
                if (c.column_name === 'id') {
                    console.log(`Column 'id' is of type: ${c.data_type}`);
                }
            });
        }
    }
}

checkTypes();
