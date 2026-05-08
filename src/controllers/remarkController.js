const supabase = require('../../db');
const { resolveLocoId, getOrCreateActiveSession } = require('../services/locomotiveService');

async function incrementUserPoints(userId, amount) {
    try {
        const { data: user } = await supabase.from('users').select('total_points').eq('id', userId).single();
        if (user) {
            const newPoints = Math.max(0, (user.total_points || 0) + amount);
            await supabase.from('users').update({ total_points: newPoints }).eq('id', userId);
        }
    } catch (e) {
        console.error("Failed to update user points:", e);
    }
}

/**
 * Remarks Controller
 * Handles business logic for locomotive remarks
 */
const remarkController = {
    /**
     * Get remark feed with filters (for dashboard/worker tasks)
     */
    getFeed: async (req, res) => {
        const { is_completed, is_verified, locomotive_id, assigned_to, specialization } = req.query;
        const activeLocationId = req.session.user.active_location_id;
        const isGlobalAdmin = req.session.user.is_global_admin;

        try {
            let query = supabase
                .from('locomotive_remarks')
                .select(`
                    *,
                    locomotive:locomotives(number, location_id),
                    assigned_user:users!locomotive_remarks_assigned_to_fkey (full_name, username, specialization),
                    completed_by:users!locomotive_remarks_completed_by_fkey (full_name, username),
                    created_by:users!locomotive_remarks_created_by_fkey (full_name, username)
                `);

            if (is_completed !== undefined) query = query.eq('is_completed', is_completed === 'true');
            if (is_verified !== undefined) query = query.eq('is_verified', is_verified === 'true');
            if (locomotive_id) query = query.eq('locomotive_id', locomotive_id);
            
            if (assigned_to) {
                query = query.eq('assigned_to', assigned_to === 'me' ? req.session.user.id : assigned_to);
            }

            const { data: remarks, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;

            let filteredResults = remarks || [];

            // Filter by location
            if (!isGlobalAdmin && activeLocationId) {
                filteredResults = filteredResults.filter(r => r.locomotive?.location_id === activeLocationId);
            }

            // Filter by specialization
            if (specialization === 'me') {
                const userSpec = req.session.user.specialization;
                const SPECIALIZATION_CATEGORIES = {
                    'Электрик': ['Электрика'],
                    'Дизелист': ['Дизель'],
                    'Ходовик': ['Ходовая'],
                    'Автоматчик': ['Автоматика'],
                };
                const categories = SPECIALIZATION_CATEGORIES[userSpec];
                if (categories && categories.length > 0) {
                    filteredResults = filteredResults.filter(r => categories.includes(r.category));
                }
            }

            res.json(filteredResults);
        } catch (err) {
            console.error("API Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Get summary of active remarks per locomotive
     */
    getActiveStats: async (req, res) => {
        try {
            const locationId = req.session.user.active_location_id;

            const { data: remarks, error } = await supabase
                .from('locomotive_remarks')
                .select(`
                    id, is_completed, is_verified,
                    locomotive:locomotives (id, number, series, location_id),
                    repair_sessions!inner(status)
                `)
                .eq('is_completed', false)
                .eq('repair_sessions.status', 'active');

            if (error) throw error;

            const stats = (remarks || []).reduce((acc, remark) => {
                const loco = remark.locomotive;
                if (!loco || (locationId && loco.location_id !== locationId)) return acc;

                if (!acc[loco.id]) {
                    acc[loco.id] = { locomotive: loco, total_remarks: 0, completed_remarks: 0 };
                }
                acc[loco.id].total_remarks++;
                if (remark.is_completed) acc[loco.id].completed_remarks++;
                return acc;
            }, {});

            res.json(Object.values(stats));
        } catch (err) {
            console.error("API Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Get remarks for a locomotive
     */
    getLocomotiveRemarks: async (req, res) => {
        try {
            const locoId = await resolveLocoId(req.params.id);
            if (!locoId) return res.status(404).json({ error: 'Локомотив не найден' });

            // Find active session
            let { data: session } = await supabase
                .from('repair_sessions')
                .select('id')
                .eq('locomotive_id', locoId)
                .eq('status', 'active')
                .maybeSingle();

            let query = supabase
                .from('locomotive_remarks')
                .select(`
                    *,
                    completed_by:users!locomotive_remarks_completed_by_fkey (full_name, username),
                    created_by:users!locomotive_remarks_created_by_fkey (full_name, username)
                `)
                .eq('locomotive_id', locoId);

            if (session) {
                query = query.eq('session_id', session.id);
            } else {
                query = query.is('session_id', null);
            }

            const { data: remarks, error } = await query
                .order('is_completed', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) throw error;
            res.json(remarks || []);
        } catch (err) {
            console.error("API Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Create a new remark
     */
    createRemark: async (req, res) => {
        try {
            const locoId = await resolveLocoId(req.params.id);
            if (!locoId) return res.status(404).json({ error: 'Локомотив не найден' });

            const { text, priority, category } = req.body;
            if (!text) return res.status(400).json({ error: 'Текст замечания обязателен' });

            const { data: loco } = await supabase.from('locomotives').select('number').eq('id', locoId).maybeSingle();
            const sessionId = await getOrCreateActiveSession(locoId, req.session.user.id, null);

            const { data, error } = await supabase
                .from('locomotive_remarks')
                .insert({
                    locomotive_id: locoId,
                    session_id: sessionId,
                    text,
                    priority: priority || 'medium',
                    category: category || null,
                    created_by: req.session.user.id
                })
                .select(`*, created_by:users!locomotive_remarks_created_by_fkey(full_name, username)`)
                .maybeSingle();

            if (error) throw error;

            if (loco) {
                await supabase.from('movements').insert({
                    locomotive_id: locoId,
                    locomotive_number: loco.number,
                    action: `remark_added: ${text}`,
                    moved_by: req.session.user.full_name || req.session.user.username
                });
            }

            res.json(data);
        } catch (err) {
            console.error("API Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Create remark from template
     */
    createFromTemplate: async (req, res) => {
        const { template_id } = req.body;
        if (!template_id) return res.status(400).json({ error: 'ID шаблона обязателен' });

        try {
            const locoId = await resolveLocoId(req.params.id);
            if (!locoId) return res.status(404).json({ error: 'Локомотив не найден' });

            const [templateRes, locoRes] = await Promise.all([
                supabase.from('remark_templates').select('*').eq('id', template_id).maybeSingle(),
                supabase.from('locomotives').select('number').eq('id', locoId).maybeSingle()
            ]);

            if (templateRes.error) throw templateRes.error;
            if (!templateRes.data) return res.status(404).json({ error: 'Шаблон не найден' });

            const template = templateRes.data;
            const loco = locoRes.data;

            const sessionId = await getOrCreateActiveSession(locoId, req.session.user.id, null);

            const { data, error } = await supabase
                .from('locomotive_remarks')
                .insert({
                    locomotive_id: locoId,
                    session_id: sessionId,
                    text: template.text,
                    priority: template.priority || 'medium',
                    category: template.category || null,
                    points: template.points || 10,
                    estimated_hours: template.estimated_hours || 0,
                    created_by: req.session.user.id
                })
                .select(`*, created_by:users!locomotive_remarks_created_by_fkey(full_name, username)`)
                .maybeSingle();

            if (error) throw error;

            // Side effects (non-blocking)
            await supabase.rpc('increment_template_usage', { t_id: template_id });
            if (loco) {
                await supabase.from('movements').insert({
                    locomotive_id: locoId,
                    locomotive_number: loco.number,
                    action: `remark_added_from_template: ${template.text}`,
                    moved_by: req.session.user.full_name || req.session.user.username
                });
            }

            res.json(data);
        } catch (err) {
            console.error("API Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Create remarks from catalog items
     */
    createFromCatalog: async (req, res) => {
        try {
            const locoId = await resolveLocoId(req.params.id);
            if (!locoId) return res.status(404).json({ error: 'Локомотив не найден' });

            const { catalog_ids, custom_texts } = req.body;
            if (!catalog_ids || !Array.isArray(catalog_ids) || catalog_ids.length === 0) {
                return res.status(400).json({ error: 'Необходим массив ID из каталога' });
            }

            // Fetch catalog items
            const { data: catalogItems, error: catError } = await supabase
                .from('remark_catalog')
                .select('id, code, category, description_ru, description_en, has_placeholder')
                .in('id', catalog_ids);

            if (catError) throw catError;
            if (!catalogItems || catalogItems.length === 0) {
                return res.status(404).json({ error: 'Записи каталога не найдены' });
            }

            const { data: loco } = await supabase.from('locomotives').select('number').eq('id', locoId).maybeSingle();
            const sessionId = await getOrCreateActiveSession(locoId, req.session.user.id, null);

            // Build remark payloads
            const customTextsMap = custom_texts || {};
            const payload = catalogItems.map(item => {
                let text = item.description_ru || item.description_en;
                // Apply custom text if provided (e.g. replace #___ with actual number)
                if (customTextsMap[item.id]) {
                    text = customTextsMap[item.id];
                }
                return {
                    locomotive_id: locoId,
                    session_id: sessionId,
                    text: `[${item.code}] ${text}`,
                    priority: 'medium',
                    category: item.category || null,
                    created_by: req.session.user.id
                };
            });

            const { data, error } = await supabase
                .from('locomotive_remarks')
                .insert(payload)
                .select('*, created_by:users!locomotive_remarks_created_by_fkey(full_name, username)');

            if (error) throw error;

            // Log movement
            if (loco) {
                await supabase.from('movements').insert({
                    locomotive_id: locoId,
                    locomotive_number: loco.number,
                    action: `remark_added_from_catalog: ${catalogItems.length} замечаний`,
                    moved_by: req.session.user.full_name || req.session.user.username
                });
            }

            res.json(data);
        } catch (err) {
            console.error('API Error (createFromCatalog):', err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Bulk create remarks
     */
    bulkCreate: async (req, res) => {
        try {
            const locoId = await resolveLocoId(req.params.id);
            if (!locoId) return res.status(404).json({ error: 'Локомотив не найден' });

            const { texts } = req.body;
            if (!texts || !Array.isArray(texts) || texts.length === 0) {
                return res.status(400).json({ error: 'Необходим массив строк замечаний' });
            }

            const { data: loco } = await supabase.from('locomotives').select('number').eq('id', locoId).maybeSingle();
            const sessionId = await getOrCreateActiveSession(locoId, req.session.user.id, null);

            const payload = texts.map(t => ({
                locomotive_id: locoId,
                session_id: sessionId,
                text: t,
                created_by: req.session.user.id
            }));

            const { data, error } = await supabase.from('locomotive_remarks').insert(payload).select();
            if (error) throw error;

            if (loco) {
                await supabase.from('movements').insert({
                    locomotive_id: locoId,
                    locomotive_number: loco.number,
                    action: `remark_added: ${texts.length} замечаний`,
                    moved_by: req.session.user.full_name || req.session.user.username
                });
            }

            res.json(data);
        } catch (err) {
            console.error("API Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Update remark basic info
     */
    updateRemark: async (req, res) => {
        const remarkId = req.params.id;
        const { text, priority, category } = req.body;

        const updates = {};
        if (text !== undefined) updates.text = text;
        if (priority !== undefined) updates.priority = priority;
        if (category !== undefined) updates.category = category;

        if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Нет данных для обновления' });

        try {
            const { data, error } = await supabase
                .from('locomotive_remarks')
                .update(updates)
                .eq('id', remarkId)
                .select(`
                    id, text, is_completed, completed_at, created_at, priority, category, locomotive_id,
                    completed_by: users!locomotive_remarks_completed_by_fkey(full_name, username),
                    created_by: users!locomotive_remarks_created_by_fkey(full_name, username)
                `);

            if (error) throw error;
            if (!data || data.length === 0) return res.status(404).json({ error: 'Замечание не найдено' });

            // Log history
            let details = [];
            if (priority !== undefined) details.push(`Изменен приоритет`);
            if (category !== undefined) details.push(`Изменена категория`);
            if (text !== undefined) details.push(`Изменен текст`);

            await supabase.from('remark_history').insert({
                remark_id: remarkId,
                user_id: req.session.user.id,
                action: 'updated',
                details: details.join(', ')
            });

            res.json(data[0]);
        } catch (err) {
            console.error("API Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Complete or reopen remark
     */
    toggleComplete: async (req, res) => {
        const remarkId = req.params.id;
        const { is_completed } = req.body;

        try {
            // Get current point value to award/deduct
            const { data: remarkInfo } = await supabase
                .from('locomotive_remarks')
                .select('points, is_completed')
                .eq('id', remarkId)
                .maybeSingle();

            if (remarkInfo && remarkInfo.is_completed !== is_completed) {
                const points = remarkInfo.points || 10; // Default 10 points for a remark
                await incrementUserPoints(req.session.user.id, is_completed ? points : -points);
            }

            const { data, error } = await supabase
                .from('locomotive_remarks')
                .update({
                    is_completed: is_completed,
                    completed_by: is_completed ? req.session.user.id : null,
                    completed_at: is_completed ? new Date().toISOString() : null
                })
                .eq('id', remarkId)
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (err) {
            console.error("API Error (toggleComplete):", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Verify remark (Using RPC)
     */
    verify: async (req, res) => {
        try {
            const { data, error } = await supabase
                .from('locomotive_remarks')
                .update({
                    is_verified: true,
                    verified_by: req.session.user.id,
                    verified_at: new Date().toISOString()
                })
                .eq('id', req.params.id)
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (err) {
            console.error("API Error (verify):", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Reject remark (Using RPC)
     */
    reject: async (req, res) => {
        const { comment } = req.body;
        try {
            const { data, error } = await supabase
                .from('locomotive_remarks')
                .update({
                    is_completed: false,
                    completed_by: null,
                    completed_at: null,
                    is_verified: false,
                    verified_by: null,
                    verified_at: null
                })
                .eq('id', req.params.id)
                .select()
                .single();

            if (error) throw error;

            if (comment) {
                await supabase.from('remark_comments').insert({
                    remark_id: req.params.id,
                    user_id: req.session.user.id,
                    text: comment
                });
            }

            res.json(data);
        } catch (err) {
            console.error("API Error (reject):", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Bulk complete remarks
     */
    bulkComplete: async (req, res) => {
        const { remark_ids } = req.body;
        if (!remark_ids || !Array.isArray(remark_ids) || remark_ids.length === 0) {
            return res.status(400).json({ error: 'Необходим массив ID замечаний' });
        }

        try {
            // Fetch remarks to calculate total points to award
            const { data: remarksInfo } = await supabase
                .from('locomotive_remarks')
                .select('points')
                .in('id', remark_ids)
                .eq('is_completed', false); // Only count those that are not yet completed

            if (remarksInfo && remarksInfo.length > 0) {
                const totalPoints = remarksInfo.reduce((sum, r) => sum + (r.points || 10), 0);
                await incrementUserPoints(req.session.user.id, totalPoints);
            }

            const { data: updatedRemarks, error: updateErr } = await supabase
                .from('locomotive_remarks')
                .update({
                    is_completed: true,
                    completed_by: req.session.user.id,
                    completed_at: new Date().toISOString()
                })
                .in('id', remark_ids)
                .select('*, locomotive:locomotives(number)');

            if (updateErr) throw updateErr;
            res.json({ success: true, count: updatedRemarks.length, updated: updatedRemarks });
        } catch (err) {
            console.error("API Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Assign remark to user
     */
    assign: async (req, res) => {
        const remarkId = req.params.id;
        const { assigned_to } = req.body;

        try {
            const { data: updated, error: updateErr } = await supabase
                .from('locomotive_remarks')
                .update({ assigned_to: assigned_to || null })
                .eq('id', remarkId)
                .select(`*, assigned_user: users!locomotive_remarks_assigned_to_fkey(full_name, username, specialization)`)
                .maybeSingle();

            if (updateErr) throw updateErr;

            let logDetails = assigned_to ? 'Назначено исполнителю' : 'Назначение снято';
            if (updated.assigned_user) logDetails += `: ${updated.assigned_user.full_name}`;

            await supabase.from('remark_history').insert({
                remark_id: remarkId,
                user_id: req.session.user.id,
                action: 'assigned',
                details: logDetails
            });

            res.json(updated);
        } catch (err) {
            console.error("API Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Get remark history
     */
    getHistory: async (req, res) => {
        try {
            const { data, error } = await supabase
                .from('remark_history')
                .select('id, action, details, created_at, user_id: users(full_name, username)')
                .eq('remark_id', req.params.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            res.json(data || []);
        } catch (err) {
            console.error("API Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Add photo to remark
     */
    addPhoto: async (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'Нет файла' });
        const remarkId = req.params.id;

        try {
            const fileExt = req.file.originalname.split('.').pop();
            const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
            const filePath = `remarks/${remarkId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('remark_attachments')
                .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage.from('remark_attachments').getPublicUrl(filePath);

            const { data, error } = await supabase
                .from('remark_photos')
                .insert({
                    remark_id: remarkId,
                    user_id: req.session.user.id,
                    photo_url: publicData.publicUrl
                })
                .select(`id, photo_url, created_at, user_id: users(full_name, username)`)
                .maybeSingle();

            if (error) throw error;

            await supabase.from('remark_history').insert({
                remark_id: remarkId,
                user_id: req.session.user.id,
                action: 'photo_added',
                details: 'Добавлено фото'
            });

            res.json(data);
        } catch (err) {
            console.error("API Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Get remark photos
     */
    getPhotos: async (req, res) => {
        try {
            const { data, error } = await supabase
                .from('remark_photos')
                .select('id, photo_url, created_at, user_id: users(full_name, username)')
                .eq('remark_id', req.params.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            res.json(data || []);
        } catch (err) {
            console.error("API Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Get remark comments
     */
    getComments: async (req, res) => {
        try {
            const { data, error } = await supabase
                .from('remark_comments')
                .select('id, text, created_at, user_id: users(full_name, username)')
                .eq('remark_id', req.params.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            res.json(data || []);
        } catch (err) {
            console.error("API Error:", err);
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * Add comment to remark
     */
    addComment: async (req, res) => {
        const { text } = req.body;
        if (!text || !text.trim()) return res.status(400).json({ error: 'Текст комментария обязателен' });

        try {
            const { data, error } = await supabase
                .from('remark_comments')
                .insert({
                    remark_id: req.params.id,
                    user_id: req.session.user.id,
                    text: text.trim()
                })
                .select(`id, text, created_at, user_id: users(full_name, username)`)
                .maybeSingle();

            if (error) throw error;
            res.json(data);
        } catch (err) {
            console.error("API Error:", err);
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = remarkController;
