const supabase = require('./db.js');
const bcrypt = require('bcryptjs');

async function testdb() {
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
        console.error("DB Error:", error);
        return;
    }
    console.log("Users in DB:", data);
    if (data && data.length > 0) {
        const admin = data.find(u => u.username === 'admin');
        if (admin) {
            console.log("Compare admin123:", bcrypt.compareSync("admin123", admin.password));
        }
    }
}
testdb();
