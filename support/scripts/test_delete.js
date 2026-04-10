const supabase = require('./db');

async function testDelete() {
    console.log("Testing delete with empty array...");
    try {
        const ids = []; // Simulate dynamic array
        if (ids.length === 0) {
            console.log("No users to delete (empty array). Skip DB call.");
            return;
        }

        const { data, error } = await supabase
            .from('users')
            .delete()
            .in('id', ids);

        if (error) {
            console.error("❌ Error:", error);
        } else {
            console.log("✅ Success:", data);
        }
    } catch (err) {
        console.error("💥 Exception:", err);
    }
}

testDelete();
