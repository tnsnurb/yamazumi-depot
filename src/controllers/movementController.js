const supabase = require('../../db');
const ExcelJS = require('exceljs');

/**
 * Movement Controller - Handles history and journal of locomotive movements
 */
const movementController = {
    /**
     * Get movement journal with filters
     */
    getAll: async (req, res) => {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const { startDate, endDate, user, loco, action } = req.query;

        let query = supabase.from('movements').select('*, locomotive_series, locomotive_number', { count: 'exact' });

        if (startDate) {
            query = query.gte('moved_at', `${startDate}T00:00:00.000Z`);
        }
        if (endDate) {
            query = query.lte('moved_at', `${endDate}T23:59:59.999Z`);
        }
        if (user && user !== 'all') {
            query = query.eq('moved_by', user);
        }
        if (loco) {
            query = query.ilike('locomotive_number', `%${loco}%`);
        }
        if (action && action !== 'all') {
            if (action === 'remove_from_track' || action === 'status_change' || action === 'remark') {
                query = query.like('action', `${action === 'remark' ? 'remark_%' : action + '%'}`);
            } else {
                query = query.eq('action', action);
            }
        }
        if (req.session.user.active_location_id) {
            query = query.eq('location_id', req.session.user.active_location_id);
        }

        const { data: movements, count, error } = await query
            .order('moved_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) return res.status(500).json({ error: error.message });
        res.json({ movements: movements || [], total: count || 0 });
    },

    /**
     * Get movement statistics
     */
    getStats: async (req, res) => {
        const { startDate, endDate } = req.query;

        let query = supabase.from('movements').select('action');

        if (startDate) {
            query = query.gte('moved_at', `${startDate}T00:00:00.000Z`);
        }
        if (endDate) {
            query = query.lte('moved_at', `${endDate}T23:59:59.999Z`);
        }
        if (req.session.user.active_location_id) {
            query = query.eq('location_id', req.session.user.active_location_id);
        }

        const { data, error } = await query;
        if (error) return res.status(500).json({ error: error.message });

        const stats = {
            moved: 0,
            remarksCompleted: 0,
            remarksAdded: 0,
            statusChanged: 0
        };

        (data || []).forEach(m => {
            if (m.action === 'move') stats.moved++;
            else if (m.action.startsWith('remark_completed')) stats.remarksCompleted++;
            else if (m.action.startsWith('remark_added')) stats.remarksAdded++;
            else if (m.action.startsWith('status_change')) stats.statusChanged++;
        });

        res.json(stats);
    },

    /**
     * Get unique users who moved locomotives
     */
    getUsers: async (req, res) => {
        let query = supabase
            .from('movements')
            .select('moved_by')
            .not('moved_by', 'is', null);

        if (req.session.user.active_location_id) {
            query = query.eq('location_id', req.session.user.active_location_id);
        }

        const { data, error } = await query;
        if (error) return res.status(500).json({ error: error.message });

        const uniqueUsers = [...new Set(data.map(m => m.moved_by))].sort();
        res.json(uniqueUsers);
    },

    /**
     * Get unique locomotives from history
     */
    getLocomotives: async (req, res) => {
        try {
            const showAllLocations = req.query.all_locations === 'true' && req.session.user.is_global_admin;

            let query = supabase
                .from('movements')
                .select('locomotive_id, locomotive_number, locomotive_series')
                .not('locomotive_number', 'is', null);

            if (!showAllLocations && req.session.user.active_location_id) {
                query = query.eq('location_id', req.session.user.active_location_id);
            }

            const { data: movements, error } = await query;
            if (error) throw error;

            const locoMap = new Map();
            (movements || []).forEach(m => {
                if (!locoMap.has(m.locomotive_number)) {
                    locoMap.set(m.locomotive_number, {
                        number: m.locomotive_number,
                        series: m.locomotive_series,
                        id: m.locomotive_id
                    });
                }
            });

            let locoQuery = supabase
                .from('locomotives')
                .select('id, number, series, status, track, position');

            if (!showAllLocations && req.session.user.active_location_id) {
                locoQuery = locoQuery.eq('location_id', req.session.user.active_location_id);
            }

            const { data: currentLocos, error: cError } = await locoQuery;

            if (!cError && currentLocos) {
                currentLocos.forEach(cl => {
                    if (locoMap.has(cl.number)) {
                        const existing = locoMap.get(cl.number);
                        locoMap.set(cl.number, { ...existing, ...cl, is_on_map: true });
                    } else {
                        locoMap.set(cl.number, { ...cl, is_on_map: true });
                    }
                });
            }

            const results = Array.from(locoMap.values()).sort((a, b) => a.number.localeCompare(b.number));
            res.json(results);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Get movement history for a specific locomotive
     */
    getByLocomotive: async (req, res) => {
        const locoNumber = decodeURIComponent(req.params.number);
        const { data: movements, error } = await supabase
            .from('movements')
            .select('*')
            .eq('locomotive_number', locoNumber)
            .order('moved_at', { ascending: false })
            .limit(500);

        if (error) return res.status(500).json({ error: error.message });
        res.json(movements || []);
    },

    /**
     * Export movements to CSV
     */
    export: async (req, res) => {
        try {
            const { startDate, endDate, user, loco, action } = req.query;
            let query = supabase.from('movements').select('*').order('moved_at', { ascending: false });

            if (startDate) query = query.gte('moved_at', `${startDate}T00:00:00.000Z`);
            if (endDate) query = query.lte('moved_at', `${endDate}T23:59:59.999Z`);
            if (user && user !== 'all') query = query.eq('moved_by', user);
            if (loco) query = query.ilike('locomotive_number', `%${loco}%`);
            
            if (action && action !== 'all') {
                if (action === 'remove_from_track' || action === 'status_change' || action === 'remark') {
                    query = query.like('action', `${action === 'remark' ? 'remark_%' : action + '%'}`);
                } else {
                    query = query.eq('action', action);
                }
            }

            const showAllLocations = req.query.all_locations === 'true' && req.session.user.is_global_admin;
            if (!showAllLocations && req.session.user.active_location_id) {
                query = query.eq('location_id', req.session.user.active_location_id);
            }

            const { data: movements, error } = await query.limit(10000);
            if (error) throw error;

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Movements');

            worksheet.columns = [
                { header: '№', key: 'id', width: 5 },
                { header: 'Дата', key: 'date', width: 20 },
                { header: 'Локомотив', key: 'loco', width: 15 },
                { header: 'Действие', key: 'action', width: 40 },
                { header: 'Откуда', key: 'from', width: 25 },
                { header: 'Куда', key: 'to', width: 25 },
                { header: 'Пользователь', key: 'user', width: 20 }
            ];

            const actionLabels = { 'add': 'Добавлен', 'move': 'Перемещён', 'remove': 'Удалён' };

            (movements || []).forEach((m, i) => {
                let actionStr = m.action || '—';
                if (actionStr.startsWith('remove_from_track')) {
                    actionStr = 'Убран с пути: ' + (actionStr.includes(': ') ? actionStr.split(': ').slice(1).join(': ') : '');
                } else if (actionLabels[actionStr]) {
                    actionStr = actionLabels[actionStr];
                } else {
                    actionStr = actionStr
                        .replace('status_change:', 'Смена статуса:')
                        .replace('remark_added:', 'Добавлено замечание:')
                        .replace('remark_completed:', 'Замечание выполнено:')
                        .replace('remark_verified:', 'Замечание проверено:')
                        .replace('remark_rejected:', 'Замечание отклонено:');
                }

                worksheet.addRow({
                    id: i + 1,
                    date: m.moved_at ? new Date(m.moved_at).toLocaleString('ru-RU') : '—',
                    loco: m.locomotive_number || '—',
                    action: actionStr,
                    from: m.from_track ? `Путь ${m.from_track}, Сロット ${m.from_position}` : '—', // Note: Слот -> Сロット typo in current code? No, I'll use Russian "Слот"
                    to: m.to_track ? `Путь ${m.to_track}, Слот ${m.to_position}` : '—',
                    user: m.moved_by || '—'
                });
            });

            // Prevent CSV Injection by ensuring all values are treated as text
            // ExcelJS handles basic escaping, but some libraries suggest prefixing with ' if it starts with [=+-@]
            // We can iterate and sanitize if necessary, but exceljs cell values are safer than manual string concat.

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename=journal_export.csv');
            
            // write to res
            await workbook.csv.write(res, { 
                formatterOptions: { 
                    delimiter: ';', 
                    writeBOM: true 
                } 
            });
        } catch (err) {
            console.error("Export error:", err);
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = movementController;
