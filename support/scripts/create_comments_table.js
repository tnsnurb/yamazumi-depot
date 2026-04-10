require('dotenv').config();
const supabase = require('./db');

async function createTable() {
    const { error } = await supabase.rpc('exec_sql', {
        sql: `CREATE TABLE IF NOT EXISTS remark_comments (
            id SERIAL PRIMARY KEY,
            remark_id INTEGER REFERENCES locomotive_remarks(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            text TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`
    });

    if (error) {
        // Try direct query approach
        const { error: err2 } = await supabase.from('remark_comments').select('id').limit(1);
        if (err2 && err2.code === '42P01') {
            console.log('Table does not exist. Please run this SQL in Supabase Dashboard:');
            console.log(`
CREATE TABLE IF NOT EXISTS remark_comments (
    id SERIAL PRIMARY KEY,
    remark_id INTEGER REFERENCES locomotive_remarks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`);
        } else if (!err2) {
            console.log('Table remark_comments already exists!');
        } else {
            console.log('Error:', err2);
        }
    } else {
        console.log('Table created successfully!');
    }
}

createTable();
