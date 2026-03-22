const supabase = require('../../db');

/**
 * Session Controller
 * Handles active repair session logic
 */
const sessionController = {
    /**
     * Get active/waiting repair sessions
     */
    getActiveSessions: async (req, res) => {
        console.log(`[API] Fetching active sessions for user ${req.session.user.username}`);
        try {
            const showAllLocations = req.query.all_locations === 'true' && req.session.user.is_global_admin;

            let query = supabase
                .from('repair_sessions')
                .select(`
                    *,
                    locomotive:locomotives(id, number, series, location_id, repair_type),
                    created_by_user:users!repair_sessions_created_by_fkey(full_name, username),
                    remarks:locomotive_remarks!locomotive_remarks_session_id_fkey(id, text, is_completed, is_verified),
                    checklists:checklist_instances!checklist_instances_session_id_fkey(id, status)
                `)
                .neq('status', 'completed')
                .order('start_date', { ascending: false });

            if (!showAllLocations && req.session.user.active_location_id) {
                query = query.eq('locomotive.location_id', req.session.user.active_location_id);
            }

            if (req.query.locomotive_id) {
                query = query.eq('locomotive_id', req.query.locomotive_id);
            }

            const { data: sessions, error } = await query;
            if (error) throw error;

            const filteredSessions = sessions.filter(s => s.locomotive);
            res.json(filteredSessions);
        } catch (err) {
            console.error("Error fetching active sessions:", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Get completed repair session history
     */
    getHistory: async (req, res) => {
        console.log(`[API] Fetching session history for user ${req.session.user.username}`);
        try {
            const showAllLocations = req.query.all_locations === 'true' && req.session.user.is_global_admin;

            let query = supabase
                .from('repair_sessions')
                .select(`
                    *,
                    locomotive:locomotives(id, number, series, location_id, repair_type),
                    created_by_user:users!repair_sessions_created_by_fkey(full_name, username),
                    remarks:locomotive_remarks!locomotive_remarks_session_id_fkey(id, text, is_completed, is_verified),
                    checklists:checklist_instances!checklist_instances_session_id_fkey(id, status)
                `)
                .eq('status', 'completed')
                .order('end_date', { ascending: false })
                .limit(200);

            if (!showAllLocations && req.session.user.active_location_id) {
                query = query.eq('locomotive.location_id', req.session.user.active_location_id);
            }

            if (req.query.locomotive_id) {
                query = query.eq('locomotive_id', req.query.locomotive_id);
            }

            const { data: sessions, error } = await query;
            if (error) throw error;

            // Filter out sessions where locomotive might be null if cross-location filtering happens at DB level
            const filteredSessions = sessions.filter(s => s.locomotive);
            res.json(filteredSessions);
        } catch (err) {
            console.error("Error fetching session history:", err);
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = sessionController;
