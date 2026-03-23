const supabase = require('../../db');
const locomotiveService = require('../services/locomotiveService');

/**
 * Locomotive Controller - Handles business logic for locomotives and movements
 */
const locomotiveController = {
    /**
     * Get all locomotives, optional location filter
     */
    getAll: async (req, res) => {
        try {
            const { location_id } = req.query;
            let query = supabase.from('locomotives').select('*');

            if (location_id) {
                query = query.eq('location_id', location_id);
            } else if (req.session.user.active_location_id) {
                query = query.eq('location_id', req.session.user.active_location_id);
            }

            const { data, error } = await query.order('number', { ascending: true });

            if (error) throw error;
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Get single locomotive by ID or number
     */
    getById: async (req, res) => {
        try {
            const { id } = req.params;
            const locoId = await locomotiveService.resolveLocoId(id);
            if (!locoId) return res.status(404).json({ error: 'Локомотив не найден' });

            const { data, error } = await supabase
                .from('locomotives')
                .select('*')
                .eq('id', locoId)
                .maybeSingle();

            if (error) throw error;
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Create or reactivate a locomotive
     */
    create: async (req, res) => {
        const { number, series, status, track, position, repair_type, planned_release, acceptance_time } = req.body;

        if (!number) {
            return res.status(400).json({ error: 'Номер локомотива обязателен' });
        }

        const cleanSeries = (series || '').trim();
        const cleanNumber = String(number).trim();

        try {
            // Check if number + series already exists globally
            const { data: existingGlobal, error: searchError } = await supabase
                .from('locomotives')
                .select(`id, status, location_id, locations!left(name)`)
                .eq('number', cleanNumber)
                .eq('series', cleanSeries)
                .maybeSingle();

            if (searchError) throw searchError;

            let loco;
            if (existingGlobal) {
                if (existingGlobal.status !== 'completed') {
                    const currentLocName = existingGlobal.locations?.name || 'другом депо';
                    return res.status(400).json({ error: `Локомотив ${cleanSeries} ${cleanNumber} уже находится в ремонте в ${currentLocName}` });
                }

                // Reactivate completed locomotive
                const { data: updated, error: updateError } = await supabase
                    .from('locomotives')
                    .update({
                        status: status || 'waiting',
                        track,
                        position,
                        repair_type,
                        planned_release,
                        acceptance_time: acceptance_time || new Date().toISOString(),
                        location_id: req.session.user.active_location_id || 1,
                        created_at: new Date().toISOString()
                    })
                    .eq('id', existingGlobal.id)
                    .select()
                    .maybeSingle();

                if (updateError) throw updateError;
                loco = updated;
            } else {
                // Insert new locomotive
                const { data: inserted, error: insertError } = await supabase
                    .from('locomotives')
                    .insert([{
                        number: cleanNumber,
                        series: cleanSeries,
                        status: status || 'waiting',
                        track,
                        position,
                        repair_type,
                        planned_release,
                        acceptance_time: acceptance_time || new Date().toISOString(),
                        location_id: req.session.user.active_location_id || 1
                    }])
                    .select()
                    .maybeSingle();

                if (insertError) throw insertError;
                loco = inserted;
            }

            if (!loco) throw new Error("Не удалось создать или обновить запись локомотива");

            // Auto-create/get repair session
            let sessionId = null;
            if (status !== 'completed') {
                sessionId = await locomotiveService.getOrCreateActiveSession(loco.id, req.session.user.id, loco.acceptance_time);
            }

            // Auto-create checklist
            if (repair_type && (status === 'repair' || !status)) {
                await locomotiveService.ensureChecklistForLocomotive(loco.id, cleanSeries, repair_type, sessionId);
            }

            // Log movement
            if (track && position) {
                await supabase.from('movements').insert({
                    locomotive_id: loco.id,
                    locomotive_series: cleanSeries,
                    locomotive_number: cleanNumber,
                    to_track: track,
                    to_position: position,
                    action: 'add',
                    moved_by: req.session.user.full_name || req.session.user.username,
                    location_id: req.session.user.active_location_id || 1
                });
            }

            res.json(loco);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Update locomotive details
     */
    update: async (req, res) => {
        try {
            const locoId = await locomotiveService.resolveLocoId(req.params.id);
            if (!locoId) return res.status(404).json({ error: 'Локомотив не найден' });

            const { status, number, series, repair_type, planned_release, acceptance_time } = req.body;

            // Get current locomotive data
            const { data: loco } = await supabase
                .from('locomotives')
                .select('*')
                .eq('id', locoId)
                .maybeSingle();

            if (!loco) return res.status(404).json({ error: 'Локомотив не найден' });

            const updates = {};
            if (number !== undefined) updates.number = number;
            if (series !== undefined) updates.series = series;
            if (status !== undefined) updates.status = status;
            if (repair_type !== undefined) updates.repair_type = repair_type;
            if (planned_release !== undefined) updates.planned_release = planned_release;
            if (acceptance_time !== undefined) updates.acceptance_time = acceptance_time;

            // Log status change to journal
            if (status !== undefined && status !== loco.status) {
                const statusLabels = { active: 'Активный', repair: 'Ремонт', waiting: 'Ожидание', completed: 'Завершён' };
                await supabase.from('movements').insert({
                    locomotive_id: loco.id,
                    locomotive_number: loco.number,
                    from_track: loco.track,
                    from_position: loco.position,
                    to_track: loco.track,
                    to_position: loco.position,
                    action: `status_change: ${statusLabels[loco.status] || loco.status} → ${statusLabels[status] || status}`,
                    moved_by: req.session.user.full_name || req.session.user.username,
                    location_id: req.session.user.active_location_id || 1
                });

                // Close active session if changing to completed
                if (status === 'completed') {
                    const { hasUncompleted, openRemarks, openChecklists } = await locomotiveService.checkUncompletedTasks(loco.id);
                    if (hasUncompleted) {
                        return res.status(400).json({
                            error: `Невозможно выпустить локомотив: осталось открытых замечаний (${openRemarks}) или незавершенных чек-листов (${openChecklists}).`
                        });
                    }

                    await supabase
                        .from('repair_sessions')
                        .update({ status: 'completed', end_date: new Date().toISOString() })
                        .eq('locomotive_id', loco.id)
                        .eq('status', 'active');
                }
            }

            // Auto-create checklist if status changed to repair or repair_type updated
            if ((status === 'repair' || (updates.repair_type && (status === 'repair' || loco.status === 'repair')))) {
                const finalSeries = updates.series || loco.series;
                const finalRepairType = updates.repair_type || loco.repair_type;
                if (finalRepairType) {
                    const sessionId = await locomotiveService.getOrCreateActiveSession(loco.id, req.session.user.id, loco.acceptance_time);
                    await locomotiveService.ensureChecklistForLocomotive(loco.id, finalSeries, finalRepairType, sessionId);
                }
            }

            const { data: updated, error } = await supabase
                .from('locomotives')
                .update(updates)
                .eq('id', locoId)
                .select()
                .maybeSingle();

            if (error) throw error;
            res.json(updated);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Delete a locomotive
     */
    delete: async (req, res) => {
        try {
            const locoId = await locomotiveService.resolveLocoId(req.params.id);
            if (!locoId) return res.status(404).json({ error: 'Локомотив не найден' });

            const { data: loco } = await supabase
                .from('locomotives')
                .select('*')
                .eq('id', locoId)
                .maybeSingle();

            if (!loco) return res.status(404).json({ error: 'Локомотив не найден' });

            // Log removal
            await supabase.from('movements').insert({
                locomotive_id: loco.id,
                locomotive_number: loco.number,
                from_track: loco.track,
                from_position: loco.position,
                action: 'remove',
                moved_by: req.session.user.full_name || req.session.user.username,
                location_id: req.session.user.active_location_id || 1
            });

            const { error } = await supabase
                .from('locomotives')
                .delete()
                .eq('id', locoId);

            if (error) throw error;
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Move locomotive (Using atomic RPC function)
     */
    move: async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const { track, position, reason } = req.body;

            // Determine action type
            const isRemoveFromTrack = (track === null && position === null);
            const actionType = isRemoveFromTrack ? 'remove_from_track' : 'move';

            // Special logic for completion checks when removing from track
            if (isRemoveFromTrack && (reason === 'Выпуск из ремонта' || reason === 'Отправка на линию')) {
                const { hasUncompleted, openRemarks, openChecklists } = await locomotiveService.checkUncompletedTasks(id);
                if (hasUncompleted) {
                    return res.status(400).json({
                        error: `Невозможно выпустить локомотив: осталось открытых замечаний (${openRemarks}) или незавершенных чек-листов (${openChecklists}).`
                    });
                }
            }

            // Call the atomic RPC function
            const { data, error } = await supabase.rpc('move_locomotive', {
                p_loco_id: id,
                p_track: track,
                p_position: position,
                p_reason: reason,
                p_moved_by: req.session.user.full_name || req.session.user.username,
                p_location_id: req.session.user.active_location_id || 1,
                p_action_type: actionType,
                p_status: (isRemoveFromTrack && (reason === 'Выпуск из ремонта' || reason === 'Отправка на линию')) ? 'completed' : null
            });

            if (error) {
                // Handle the custom RAISE EXCEPTION messages from SQL
                if (error.message === 'Target position already occupied') {
                    return res.status(400).json({ error: 'Эта позиция уже занята' });
                }
                throw error;
            }

            // If we marked as completed via reason, we need to update the repair_session separately 
            if (isRemoveFromTrack && (reason === 'Выпуск из ремонта' || reason === 'Отправка на линию')) {
                 await supabase
                    .from('repair_sessions')
                    .update({ status: 'completed', end_date: new Date().toISOString() })
                    .eq('locomotive_id', id)
                    .eq('status', 'active');
            }

            res.json(data);
        } catch (err) {
            console.error("Move error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Get wheelset measurements
     */
    getWheelset: async (req, res) => {
        try {
            const locoId = await locomotiveService.resolveLocoId(req.params.id);
            if (!locoId) return res.status(404).json({ error: 'Локомотив не найден' });

            const { data, error } = await supabase
                .from('wheelset_measurements')
                .select('*')
                .eq('locomotive_id', locoId)
                .order('axle_number', { ascending: true })
                .order('side', { ascending: true });

            if (error) throw error;
            res.json(data || []);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Save wheelset measurements
     */
    saveWheelset: async (req, res) => {
        const measurements = req.body;
        try {
            const locoId = await locomotiveService.resolveLocoId(req.params.id);
            if (!locoId) return res.status(404).json({ error: 'Локомотив не найден' });

            const { data: session } = await supabase
                .from('repair_sessions')
                .select('id')
                .eq('locomotive_id', locoId)
                .eq('status', 'active')
                .maybeSingle();

            if (!session) return res.status(400).json({ error: 'Нет активной ремонтной сессии для этого локомотива' });

            const userUuid = req.session.user?.uuid;
            if (!userUuid) return res.status(401).json({ error: "Сессия пользователя повреждена." });

            const toInsert = measurements.map(m => ({
                ...m,
                locomotive_id: locoId,
                session_id: session.id,
                measured_by: userUuid,
                measured_at: new Date().toISOString()
            }));

            const { data, error } = await supabase
                .from('wheelset_measurements')
                .upsert(toInsert, { onConflict: 'session_id, axle_number, side' })
                .select();

            if (error) throw error;

            await supabase.from('movements').insert({
                locomotive_id: locoId,
                action: 'wheelset_measured',
                details: `Выполнены замеры колесных пар (${toInsert.length} оп.)`,
                moved_by: req.session.user.full_name || req.session.user.username,
                location_id: req.session.user.active_location_id || 1
            });

            res.json({ success: true, data });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Export wheelset measurements to CSV
     */
    exportWheelset: async (req, res) => {
        try {
            const locoId = await locomotiveService.resolveLocoId(req.params.id);
            if (!locoId) return res.status(404).json({ error: 'Локомотив не найден' });

            const { data: loco } = await supabase.from('locomotives').select('number, series').eq('id', locoId).maybeSingle();

            const { data: measurements, error } = await supabase
                .from('wheelset_measurements')
                .select('*')
                .eq('locomotive_id', locoId)
                .order('axle_number', { ascending: true })
                .order('side', { ascending: true });

            if (error) throw error;

            const header = 'Ось;Сторона;Толщина бандажа;Прокат;Толщина гребня;Крутизна гребня;Диаметр;Дата замера\n';
            const rows = (measurements || []).map(m => {
                const date = m.measured_at ? new Date(m.measured_at).toLocaleString('ru-RU') : '—';
                return `${m.axle_number};${m.side === 'Left' ? 'Лево' : 'Право'};${m.tire_thickness || 0};${m.wear || 0};${m.flange_thickness || 0};${m.flange_steepness || 0};${m.diameter || 0};${date}`;
            }).join('\n');

            const bom = '\ufeff'; 
            const filename = `wheelset_${loco?.series || ''}_${loco?.number || locoId}.csv`;
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            res.send(bom + header + rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Get repair session history for a locomotive
     */
    getSessions: async (req, res) => {
        try {
            const locoId = await locomotiveService.resolveLocoId(req.params.id);
            if (!locoId) return res.status(404).json({ error: 'Локомотив не найден' });

            const { data, error } = await supabase
                .from('repair_sessions')
                .select(`
                    *,
                    locomotive:locomotives(id, number, series),
                    created_by_user:users!repair_sessions_created_by_fkey(full_name, username),
                    remarks:locomotive_remarks!locomotive_remarks_session_id_fkey(id, text, status, is_template)
                `)
                .eq('locomotive_id', locoId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            res.json(data || []);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = locomotiveController;
