const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function debug() {
    const { data: rt } = await supabase.from('repair_types').select('*');
    const { data: loco } = await supabase.from('locomotives').select('id, number, series, status, repair_type');
    const { data: ct } = await supabase.from('checklist_templates').select('id, series, repair_type_id');

    console.log(JSON.stringify({ repair_types: rt, locomotives: loco, templates: ct }, null, 2));
}

debug();
