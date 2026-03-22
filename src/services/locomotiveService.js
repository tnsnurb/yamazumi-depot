const supabase = require('../../db');

/**
 * Helper to resolve locomotive identifier (ID, Number, or Series+Number) to internal UUID
 * @param {string|number} idOrNumber 
 * @returns {Promise<string|null>}
 */
async function resolveLocoId(idOrNumber) {
    if (!idOrNumber) return null;
    
    const decodedId = decodeURIComponent(String(idOrNumber)).trim();

    // 1. Check if it's a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedId);
    if (isUUID) return decodedId;

    // 2. Check if it's a numeric ID (direct table ID)
    const isNumeric = !isNaN(decodedId) && !isNaN(parseFloat(decodedId));
    if (isNumeric) {
        const { data: byId } = await supabase.from('locomotives').select('id').eq('id', decodedId).maybeSingle();
        if (byId) return byId.id;
    }

    // 3. Handle series + number (e.g., "ТЭ33А 0002" or just "0002")
    // Fallback to searching by series/number
    const parts = decodedId.split(/\s+/);
    let series = '';
    let number = decodedId;

    if (parts.length > 1) {
        series = parts[0];
        number = parts.slice(1).join(' ');
    }

    // Try combined series + number
    const { data: byFullMatch } = await supabase
        .from('locomotives')
        .select('id')
        .eq('series', series)
        .eq('number', number)
        .maybeSingle();
    
    if (byFullMatch) return byFullMatch.id;

    // try just number
    const { data: byNumber } = await supabase
        .from('locomotives')
        .select('id')
        .eq('number', decodedId)
        .maybeSingle();
        
    return byNumber?.id || null;
}

/**
 * Get active repair session or create a new one
 */
async function getOrCreateActiveSession(locoId, userId, acceptanceTime) {
    let { data: session } = await supabase
        .from('repair_sessions')
        .select('id')
        .eq('locomotive_id', locoId)
        .eq('status', 'active')
        .maybeSingle();

    if (session) return session.id;

    try {
        const { data: newSession, error } = await supabase
            .from('repair_sessions')
            .insert([{
                locomotive_id: locoId,
                start_date: acceptanceTime || new Date().toISOString(),
                status: 'active',
                created_by: userId
            }])
            .select()
            .single();
        if (error) throw error;
        return newSession.id;
    } catch (err) {
        console.error("Failed to create repair session:", err);
        return null;
    }
}

/**
 * Check for open remarks/checklists before closing session
 */
async function checkUncompletedTasks(locoId) {
    const { data: session } = await supabase
        .from('repair_sessions')
        .select('id')
        .eq('locomotive_id', locoId)
        .eq('status', 'active')
        .maybeSingle();

    if (!session) return { openRemarks: 0, openChecklists: 0, hasUncompleted: false };

    const { count: openRemarks } = await supabase
        .from('locomotive_remarks')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .eq('is_completed', false);

    const { count: openChecklists } = await supabase
        .from('checklist_instances')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .neq('status', 'completed');

    return {
        openRemarks: openRemarks || 0,
        openChecklists: openChecklists || 0,
        hasUncompleted: (openRemarks > 0 || openChecklists > 0)
    };
}

/**
 * Ensure a checklist instance exists for the given series/repairType
 */
async function ensureChecklistForLocomotive(locoId, series, repairTypeInput, sessionId) {
    if (!repairTypeInput || repairTypeInput === 'none') return;

    try {
        let repairTypeId = parseInt(repairTypeInput);
        if (isNaN(repairTypeId)) {
            const { data: rt } = await supabase
                .from('repair_types')
                .select('id')
                .eq('name', repairTypeInput)
                .maybeSingle();
            if (rt) repairTypeId = rt.id;
            else return;
        }

        const { data: existingInstance } = await supabase
            .from('checklist_instances')
            .select('id')
            .eq('locomotive_id', locoId)
            .neq('status', 'completed')
            .maybeSingle();

        if (existingInstance) return;

        const { data: template } = await supabase
            .from('checklist_templates')
            .select('id')
            .eq('series', series)
            .eq('repair_type_id', repairTypeId)
            .maybeSingle();

        if (!template) return;

        const { data: instance, error: instanceError } = await supabase
            .from('checklist_instances')
            .insert([{
                locomotive_id: locoId,
                template_id: template.id,
                status: 'in_progress',
                session_id: sessionId
            }])
            .select()
            .single();

        if (instanceError || !instance) throw instanceError || new Error("Failed to create checklist instance");

        const { data: templateItems } = await supabase
            .from('checklist_template_items')
            .select('*')
            .eq('template_id', template.id)
            .order('sort_order', { ascending: true });

        if (templateItems && templateItems.length > 0) {
            const instanceItems = templateItems.map(ti => ({
                instance_id: instance.id,
                template_item_id: ti.id,
                sort_order: ti.sort_order,
                group_name: ti.group_name,
                short_description: ti.short_description,
                full_description: ti.full_description,
                executor_role: ti.executor_role,
                controller_role: ti.controller_role,
                is_completed: false
            }));

            await supabase.from('checklist_instance_items').insert(instanceItems);
        }
        console.log(`Auto-created checklist for loco ${locoId} using template ${template.id}`);
    } catch (err) {
        console.error("Error in ensureChecklistForLocomotive:", err);
    }
}

module.exports = {
    resolveLocoId,
    getOrCreateActiveSession,
    checkUncompletedTasks,
    ensureChecklistForLocomotive
};
