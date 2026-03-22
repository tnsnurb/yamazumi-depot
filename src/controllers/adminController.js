const supabase = require('../../db');

/**
 * Admin Controller
 * Handles administrative system logic (Audit Logs, etc.)
 */
const adminController = {
    /**
     * Get system audit logs
     */
    getAuditLogs: async (req, res) => {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;

        try {
            let query = supabase
                .from('audit_logs')
                .select(`
                    id, action, target, details, created_at,
                    user:users!audit_logs_user_id_fkey(username, full_name, locations:locations(name))
                `, { count: 'exact' });

            if (req.session.user.active_location_id && req.session.user.role !== 'admin') {
                query = query.eq('users.location_id', req.session.user.active_location_id);
            }

            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;
            res.json({ logs: data || [], total: count || 0 });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = adminController;
