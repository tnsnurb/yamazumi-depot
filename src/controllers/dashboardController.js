const supabase = require('../../db');

/**
 * Dashboard Controller - Handles main stats and charts
 */
const dashboardController = {
    /**
     * Get dashboard chart data (movements over last 30 days)
     */
    getChartData: async (req, res) => {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            let mQuery = supabase
                .from('movements')
                .select('moved_at, action')
                .gte('moved_at', thirtyDaysAgo.toISOString())
                .order('moved_at', { ascending: true });

            const showAllLocations = req.query.all_locations === 'true' && req.session.user.is_global_admin;
            if (!showAllLocations && req.session.user.active_location_id) {
                mQuery = mQuery.eq('location_id', req.session.user.active_location_id);
            }
            const { data: movements } = await mQuery;

            // Group by day
            const dailyCounts = {};
            for (let i = 0; i < 30; i++) {
                const d = new Date();
                d.setDate(d.getDate() - (29 - i));
                const key = d.toISOString().split('T')[0];
                dailyCounts[key] = 0;
            }

            (movements || []).forEach(m => {
                const key = m.moved_at.split('T')[0];
                if (dailyCounts[key] !== undefined) dailyCounts[key]++;
            });

            const chart = Object.entries(dailyCounts).map(([date, count]) => ({
                date,
                label: new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
                count
            }));

            // Average repair time (Limited to last 90 days to prevent unbounded full table scans)
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

            let allMQuery = supabase
                .from('movements')
                .select('locomotive_number, action, moved_at')
                .gte('moved_at', ninetyDaysAgo.toISOString())
                .order('moved_at', { ascending: true });

            if (!showAllLocations && req.session.user.active_location_id) {
                allMQuery = allMQuery.eq('location_id', req.session.user.active_location_id);
            }
            const { data: allMovements } = await allMQuery;

            const repairTimes = {};
            const addTimes = {};
            (allMovements || []).forEach(m => {
                if (m.action === 'add') {
                    addTimes[m.locomotive_number] = new Date(m.moved_at);
                }
                if (m.action.startsWith('remove_from_track') && addTimes[m.locomotive_number]) {
                    const duration = new Date(m.moved_at) - addTimes[m.locomotive_number];
                    const days = Math.round(duration / (1000 * 60 * 60 * 24));
                    if (!repairTimes.all) repairTimes.all = [];
                    repairTimes.all.push(days);
                    delete addTimes[m.locomotive_number];
                }
            });

            const avgRepairDays = repairTimes.all && repairTimes.all.length > 0
                ? Math.round(repairTimes.all.reduce((a, b) => a + b, 0) / repairTimes.all.length)
                : null;

            res.json({ chart, avgRepairDays, totalRepairs: repairTimes.all?.length || 0 });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Get main dashboard stats (counts, occupancy, etc.)
     */
    getStats: async (req, res) => {
        try {
            const showAllLocations = req.query.all_locations === 'true' && req.session.user.is_global_admin;

            // Total locomotives
            let locQuery1 = supabase.from('locomotives').select('*', { count: 'exact', head: true });
            if (!showAllLocations && req.session.user.active_location_id) locQuery1 = locQuery1.eq('location_id', req.session.user.active_location_id);

            // On tracks
            let locQuery2 = supabase.from('locomotives').select('id, status, track').not('track', 'is', null);
            if (!showAllLocations && req.session.user.active_location_id) locQuery2 = locQuery2.eq('location_id', req.session.user.active_location_id);

            // Movements today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let mTodayQ = supabase.from('movements').select('*', { count: 'exact', head: true }).gte('moved_at', today.toISOString());
            if (!showAllLocations && req.session.user.active_location_id) mTodayQ = mTodayQ.eq('location_id', req.session.user.active_location_id);

            // Movements this week
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            let mWeekQ = supabase.from('movements').select('*', { count: 'exact', head: true }).gte('moved_at', weekAgo.toISOString());
            if (!showAllLocations && req.session.user.active_location_id) mWeekQ = mWeekQ.eq('location_id', req.session.user.active_location_id);

            // Overdue Repairs (in repair status for > 3 days)
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            let overdueQ = supabase.from('locomotives')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'repair')
                .lt('updated_at', threeDaysAgo.toISOString());
            if (!showAllLocations && req.session.user.active_location_id) overdueQ = overdueQ.eq('location_id', req.session.user.active_location_id);

            // Recent Activity (last 10 movements/remarks)
            let activityQ = supabase.from('movements')
                .select('id, locomotive_number, action, moved_at, moved_by')
                .order('moved_at', { ascending: false })
                .limit(10);
            if (!showAllLocations && req.session.user.active_location_id) activityQ = activityQ.eq('location_id', req.session.user.active_location_id);

            // Build Overdue/Expiring Gauges Query
            const twoWeeksFromNow = new Date();
            twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
            const overdueGaugesQuery = supabase
                .from('gauges')
                .select('id', { count: 'exact', head: true })
                .lt('next_verification', twoWeeksFromNow.toISOString().split('T')[0])
                .neq('status', 'Списан');

            // Execute all queries concurrently to eliminate waterfall latencies
            const [
                { count: totalLocos },
                { data: onTracks },
                { count: movementsToday },
                { count: movementsWeek },
                { count: overdueRepairs },
                { data: recentActivity },
                { count: overdueGauges }
            ] = await Promise.all([
                locQuery1,
                locQuery2,
                mTodayQ,
                mWeekQ,
                overdueQ,
                activityQ,
                overdueGaugesQuery
            ]);

            // Track utilization and status breakdown
            const statusCounts = { active: 0, repair: 0, waiting: 0, completed: 0 };
            const trackOccupancy = {};
            (onTracks || []).forEach(l => {
                statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
                trackOccupancy[l.track] = (trackOccupancy[l.track] || 0) + 1;
            });

            const totalSlots = 36;
            const occupiedSlots = (onTracks || []).length;

            res.json({
                totalLocomotives: totalLocos || 0,
                onTracks: occupiedSlots,
                totalSlots,
                statusCounts,
                trackOccupancy,
                movementsToday: movementsToday || 0,
                movementsWeek: movementsWeek || 0,
                overdueRepairs: overdueRepairs || 0,
                overdueGauges: overdueGauges || 0,
                recentActivity: recentActivity || []
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = dashboardController;
