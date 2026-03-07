const express = require('express');
const supabase = require('../../db');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// Mapping: specialization → remark categories
const SPECIALIZATION_CATEGORIES = {
    'Электрик': ['Электрика'],
    'Дизелист': ['Дизель'],
    'Ходовик': ['Ходовая'],
    'Автоматчик': ['Автоматика'],
};

// Get all remarks (for overall dashboard/worker tasks)
router.get('/', requireAuth, async (req, res) => {
    console.log(`\n=== REMARKS FEED REQUEST ===`);
    console.log(`User: ${req.session.user.username} (Global Admin: ${req.session.user.is_global_admin})`);
    console.log(`Active Location: ${req.session.user.active_location_id}`);

    const { is_completed, is_verified, locomotive_id } = req.query;
    console.log(`Filters - completed: ${is_completed}, verified: ${is_verified}, loco: ${locomotive_id}`);

    try {
        let query = supabase
            .from('locomotive_remarks')
            .select(`
                *,
                locomotive:locomotives(number, location_id),
                assigned_user:users!locomotive_remarks_assigned_to_fkey (
                    full_name,
                    username,
                    specialization
                ),
                completed_by:users!locomotive_remarks_completed_by_fkey (
                    full_name,
                    username
                ),
                created_by:users!locomotive_remarks_created_by_fkey (
                    full_name,
                    username
                )
            `);

        if (is_completed !== undefined) {
            query = query.eq('is_completed', is_completed === 'true');
        }
        if (is_verified !== undefined) {
            query = query.eq('is_verified', is_verified === 'true');
        }
        if (locomotive_id) {
            query = query.eq('locomotive_id', locomotive_id);
        }
        if (req.query.assigned_to) {
            if (req.query.assigned_to === 'me') {
                query = query.eq('assigned_to', req.session.user.id);
            } else {
                query = query.eq('assigned_to', req.query.assigned_to);
            }
        }

        const { data: remarks, error } = await query
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Supabase error fetching remarks:", error);
            return res.status(500).json({ error: error.message });
        }

        // Filter results by location in JS for safety if needed
        let filteredResults = remarks || [];
        if (!req.session.user.is_global_admin && req.session.user.active_location_id) {
            filteredResults = filteredResults.filter(r => r.locomotive?.location_id === req.session.user.active_location_id);
        }

        // Filter by specialization categories
        if (req.query.specialization === 'me') {
            const userSpec = req.session.user.specialization;
            const categories = SPECIALIZATION_CATEGORIES[userSpec];
            if (categories && categories.length > 0) {
                filteredResults = filteredResults.filter(r => categories.includes(r.category));
                console.log(`Filtered by specialization "${userSpec}" → categories: [${categories.join(', ')}]`);
            }
        }

        console.log(`Returning ${filteredResults.length} remarks`);
        res.json(filteredResults);
    } catch (err) {
        console.error("General error in /api/remarks:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
