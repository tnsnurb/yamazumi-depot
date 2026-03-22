
const supabase = require('./db');

async function testInsert() {
    try {
        const locoId = 62; // Valid ID
        const sessionId = null;
        const template = { text: "Test Remark", priority: "medium" };
        const userId = 21; // Valid ID

        console.log("Testing insert with relationship select...");
        const { data, error } = await supabase
            .from('locomotive_remarks')
            .insert({
                locomotive_id: locoId,
                session_id: sessionId,
                text: template.text,
                priority: template.priority || 'medium',
                category: null,
                points: 10,
                estimated_hours: 0,
                created_by: userId
            })
            .select(`*, created_by:users!locomotive_remarks_created_by_fkey(full_name, username)`)
            .maybeSingle();

        if (error) {
            console.error("Insert failed with error:", error);
        } else {
            console.log("Insert successful! Data:", data);
        }
    } catch (err) {
        console.error("Unexpected error:", err);
    }
}

testInsert();
