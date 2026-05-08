const supabase = require('./db.js');
async function test() {
    const { data: users } = await supabase.from('users').select('id, total_points').limit(1);
    if(users && users.length > 0) {
        console.log("Found user:", users[0]);
        const { data, error } = await supabase.rpc('increment_user_points', { user_id: users[0].id, amount: 1 });
        console.log("RPC Error:", error);
    }
}
test();
