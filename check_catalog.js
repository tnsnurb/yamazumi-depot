const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkCatalogSize() {
    const { count, error } = await supabase
        .from('locomotive_catalog')
        .select('count', { count: 'exact', head: true });

    if (error) {
        console.error(error);
        return;
    }
    console.log('Catalog size:', count);
}

checkCatalogSize();
