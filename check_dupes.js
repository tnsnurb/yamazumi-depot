const supabase = require('./db');

async function checkDuplicates() {
    console.log("Checking for duplicate usernames...");
    const { data: users, error: usersError } = await supabase.from('users').select('username');
    if (usersError) {
        console.error("Error fetching users:", usersError);
    } else {
        const counts = {};
        users.forEach(u => counts[u.username] = (counts[u.username] || 0) + 1);
        const duplicates = Object.keys(counts).filter(k => counts[k] > 1);
        if (duplicates.length > 0) {
            console.log("Duplicate usernames found:", duplicates);
        } else {
            console.log("No duplicate usernames.");
        }
    }

    console.log("Checking for duplicate roles...");
    const { data: roles, error: rolesError } = await supabase.from('roles').select('name');
    if (rolesError) {
        console.error("Error fetching roles:", rolesError);
    } else {
        const counts = {};
        roles.forEach(r => counts[r.name] = (counts[r.name] || 0) + 1);
        const duplicates = Object.keys(counts).filter(k => counts[k] > 1);
        if (duplicates.length > 0) {
            console.log("Duplicate roles found:", duplicates);
        } else {
            console.log("No duplicate roles.");
        }
    }
}

checkDuplicates();
