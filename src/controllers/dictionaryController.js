const supabase = require('../../db');

/**
 * Dictionary Controller - Handles system-wide reference data (catalogs, templates, etc.)
 */
const dictionaryController = {
    // ===================== CATALOG =====================
    
    getCatalog: async (req, res) => {
        const { data, error } = await supabase
            .from('locomotive_catalog')
            .select('id, series, number')
            .order('series', { ascending: true })
            .order('number', { ascending: true });

        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    },

    createCatalogManual: async (req, res) => {
        const { number, series } = req.body;
        if (!number || !number.trim()) return res.status(400).json({ error: 'Номер локомотива обязателен' });

        const cleanSeries = (series || '').trim();
        const cleanNumber = number.trim();

        const { data, error } = await supabase
            .from('locomotive_catalog')
            .insert([{ series: cleanSeries, number: cleanNumber }])
            .select()
            .maybeSingle();

        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'Такой локомотив уже есть в каталоге' });
            return res.status(500).json({ error: error.message });
        }

        // Audit Log
        await supabase.from('audit_logs').insert({
            user_id: req.session.user.id,
            action: 'Добавлен локомотив вручную',
            target: `${cleanSeries} ${cleanNumber}`.trim(),
            details: `Каталог`
        });

        res.json(data);
    },

    updateCatalog: async (req, res) => {
        const { id } = req.params;
        const { number, series } = req.body;
        if (!number || !number.trim()) return res.status(400).json({ error: 'Номер локомотива обязателен' });

        const cleanSeries = (series || '').trim();
        const cleanNumber = number.trim();

        // Ensure it exists in catalog first to log old name
        const { data: oldData } = await supabase.from('locomotive_catalog').select('series, number').eq('id', id).maybeSingle();

        const { data, error } = await supabase
            .from('locomotive_catalog')
            .update({ series: cleanSeries, number: cleanNumber })
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });

        // Audit Log
        await supabase.from('audit_logs').insert({
            user_id: req.session.user.id,
            action: 'Изменен локомотив в каталоге',
            target: `${cleanSeries} ${cleanNumber}`.trim(),
            details: `Было: ${oldData ? (oldData.series + ' ' + oldData.number).trim() : 'неизвестно'}`
        });

        res.json(data);
    },

    deleteCatalog: async (req, res) => {
        const { id } = req.params;
        const { data: oldData } = await supabase.from('locomotive_catalog').select('number').eq('id', id).maybeSingle();

        const { error } = await supabase.from('locomotive_catalog').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });

        // Audit Log
        if (oldData) {
            await supabase.from('audit_logs').insert({
                user_id: req.session.user.id,
                action: 'Удален локомотив из каталога',
                target: oldData.number,
                details: `ИД каталога: ${id}`
            });
        }

        res.json({ success: true });
    },

    bulkCreateCatalog: async (req, res) => {
        const numbers = req.body;
        if (!Array.isArray(numbers) || numbers.length === 0) {
            return res.status(400).json({ error: 'Требуется массив номеров' });
        }

        const toInsert = numbers.map(n => {
            const fullString = typeof n === 'object' ? String(n.number || n['Номер'] || '').trim() : String(n).trim();
            const parts = fullString.split(/\s+/);
            let series = '';
            let number = fullString;
            if (parts.length > 1) {
                series = parts[0];
                number = parts.slice(1).join(' ');
            } else if (typeof n === 'object' && n.series) {
                series = String(n.series).trim();
            }
            return { series: series || '', number: number.trim() };
        }).filter(n => n.number);

        if (toInsert.length === 0) {
            return res.status(400).json({ error: 'Пустой список' });
        }

        const { data, error } = await supabase
            .from('locomotive_catalog')
            .upsert(toInsert, { onConflict: 'series,number', ignoreDuplicates: true })
            .select();

        if (error) return res.status(500).json({ error: error.message });

        // Audit Log
        await supabase.from('audit_logs').insert({
            user_id: req.session.user.id,
            action: 'Массовая загрузка каталога',
            target: `Записей: ${toInsert.length}`,
            details: `Успешно загружено: ${data ? data.length : 0}`
        });

        res.json({ success: true, count: data ? data.length : 0, data });
    },

    // ===================== REMARK TEMPLATES =====================
    
    getRemarkTemplates: async (req, res) => {
        try {
            const { data, error } = await supabase
                .from('remark_templates')
                .select('*')
                .order('usage_count', { ascending: false })
                .order('text', { ascending: true });

            if (error) throw error;
            res.json(data);
        } catch (err) {
            console.error("Error fetching templates:", err);
            res.status(500).json({ error: err.message });
        }
    },

    createRemarkTemplate: async (req, res) => {
        try {
            const { text, specialization, priority, category, estimated_hours } = req.body;
            if (!text || !text.trim()) return res.status(400).json({ error: 'Текст замечания обязателен' });

            const insertData = {
                text: text.trim(),
                specialization: specialization || null,
                priority: priority || 'medium',
                category: category || null,
                estimated_hours: estimated_hours || null
            };

            const { data, error } = await supabase
                .from('remark_templates')
                .insert([insertData])
                .select()
                .maybeSingle();

            if (error) throw error;

            // Audit Log
            await supabase.from('audit_logs').insert({
                user_id: req.session.user.id,
                action: 'Добавлен шаблон замечания',
                target: text.trim(),
                details: `Специализация: ${specialization}`
            });

            res.json(data);
        } catch (err) {
            console.error("Error creating template:", err);
            res.status(500).json({ error: err.message });
        }
    },

    bulkCreateRemarkTemplates: async (req, res) => {
        try {
            const templates = req.body;
            if (!Array.isArray(templates) || templates.length === 0) {
                return res.status(400).json({ error: 'Ожидается непустой массив шаблонов' });
            }

            const insertData = templates.map(t => ({
                text: t.text?.trim() || 'Без описания',
                specialization: t.specialization || null,
                priority: t.priority || 'medium',
                category: t.category || null,
                estimated_hours: t.estimated_hours || null
            }));

            const { data, error } = await supabase
                .from('remark_templates')
                .insert(insertData)
                .select();

            if (error) throw error;

            // Audit Log
            await supabase.from('audit_logs').insert({
                user_id: req.session.user.id,
                action: 'Массовый импорт шаблонов замечаний',
                target: `Записей: ${insertData.length}`,
                details: `Успешно загружено: ${data ? data.length : 0}`
            });

            res.json({ success: true, count: data ? data.length : 0, data });
        } catch (err) {
            console.error("Error bulk creating templates:", err);
            res.status(500).json({ error: err.message });
        }
    },

    updateRemarkTemplate: async (req, res) => {
        try {
            const { id } = req.params;
            const { text, specialization, priority, category, estimated_hours } = req.body;

            const updateData = {};
            if (text !== undefined) updateData.text = text.trim();
            if (specialization !== undefined) updateData.specialization = specialization;
            if (priority !== undefined) updateData.priority = priority;
            if (category !== undefined) updateData.category = category;
            if (estimated_hours !== undefined) updateData.estimated_hours = estimated_hours;

            const { data, error } = await supabase
                .from('remark_templates')
                .update(updateData)
                .eq('id', id)
                .select()
                .maybeSingle();

            if (error) throw error;
            if (!data) return res.status(404).json({ error: 'Шаблон не найден' });

            // Audit Log
            await supabase.from('audit_logs').insert({
                user_id: req.session.user.id,
                action: 'Изменен шаблон замечания',
                target: text || 'ID: ' + id,
                details: `Обновлено полей: ${Object.keys(updateData).join(', ')}`
            });

            res.json(data);
        } catch (err) {
            console.error("Error updating template:", err);
            res.status(500).json({ error: err.message });
        }
    },

    deleteRemarkTemplate: async (req, res) => {
        try {
            const { id } = req.params;

            // Get old data for audit log
            const { data: oldData } = await supabase.from('remark_templates').select('text').eq('id', id).maybeSingle();

            const { error } = await supabase.from('remark_templates').delete().eq('id', id);
            if (error) throw error;

            // Audit Log
            if (oldData) {
                await supabase.from('audit_logs').insert({
                    user_id: req.session.user.id,
                    action: 'Удален шаблон замечания',
                    target: oldData.text,
                    details: `ID шаблона: ${id}`
                });
            }

            res.json({ success: true });
        } catch (err) {
            console.error("Error deleting template:", err);
            res.status(500).json({ error: err.message });
        }
    },

    // ===================== REPAIR TYPES =====================
    
    getRepairTypes: async (req, res) => {
        const { data, error } = await supabase
            .from('repair_types')
            .select('id, name')
            .order('id', { ascending: true });

        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    },

    createRepairType: async (req, res) => {
        let { name } = req.body;
        if (!name || !String(name).trim()) return res.status(400).json({ error: 'Название обязательно' });
        name = String(name).trim();

        const { data, error } = await supabase
            .from('repair_types')
            .insert([{ name }])
            .select()
            .maybeSingle();

        if (error) {
            if (error.code === '23505') {
                return res.status(400).json({ error: 'Такой тип ремонта уже существует' });
            }
            return res.status(500).json({ error: error.message });
        }
        res.json(data);
    },

    deleteRepairType: async (req, res) => {
        const { id } = req.params;
        const { error } = await supabase.from('repair_types').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true });
    },

    // ===================== ROLES =====================
    
    getRoles: async (req, res) => {
        const { data, error } = await supabase
            .from('roles')
            .select('*')
            .order('id', { ascending: true });

        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    },

    createRole: async (req, res) => {
        let { 
            name, description, can_view_dashboard, can_view_map, 
            can_view_journal, can_move_locomotives, can_edit_catalog, 
            can_manage_users, can_complete_remarks, can_verify_remarks 
        } = req.body;
        
        if (!name) return res.status(400).json({ error: 'Name is required' });

        // Normalize role name to lowercase/no-spaces
        name = String(name).trim().toLowerCase().replace(/\s+/g, '_');

        const { data, error } = await supabase
            .from('roles')
            .insert([{
                name,
                description: description || '',
                can_view_dashboard: can_view_dashboard || false,
                can_view_map: can_view_map ?? true,
                can_view_journal: can_view_journal ?? true,
                can_move_locomotives: can_move_locomotives || false,
                can_edit_catalog: can_edit_catalog || false,
                can_manage_users: can_manage_users || false,
                can_complete_remarks: can_complete_remarks ?? true,
                can_verify_remarks: can_verify_remarks || false
            }])
            .select()
            .maybeSingle();

        if (error) {
            if (error.code === '23505') {
                return res.status(400).json({ error: 'Роль с таким названием уже существует' });
            }
            return res.status(500).json({ error: error.message });
        }
        res.json(data);
    },

    updateRole: async (req, res) => {
        const { id } = req.params;
        let { 
            name, description, can_view_dashboard, can_view_map, 
            can_view_journal, can_move_locomotives, can_edit_catalog, 
            can_manage_users, can_complete_remarks, can_verify_remarks 
        } = req.body;

        // First check if it's admin role, or if exists
        const { data: roleData } = await supabase.from('roles').select('*').eq('id', id).maybeSingle();
        if (!roleData) {
            return res.status(404).json({ error: 'Роль не найдена' });
        }

        if (roleData.name === 'admin' || roleData.name === 'employee') {
            const { data, error } = await supabase
                .from('roles')
                .update({
                    can_view_dashboard: can_view_dashboard || false,
                    can_view_map: can_view_map ?? true,
                    can_view_journal: can_view_journal ?? true,
                    can_move_locomotives: can_move_locomotives || false,
                    can_edit_catalog: can_edit_catalog || false,
                    can_manage_users: can_manage_users || false,
                    can_complete_remarks: can_complete_remarks ?? true,
                    can_verify_remarks: can_verify_remarks || false
                })
                .eq('id', id)
                .select()
                .maybeSingle();
            if (error) return res.status(500).json({ error: error.message });
            return res.json(data);
        }

        if (name) {
            name = String(name).trim().toLowerCase().replace(/\s+/g, '_');
        }

        const updates = {
            can_view_dashboard: can_view_dashboard || false,
            can_view_map: can_view_map ?? true,
            can_view_journal: can_view_journal ?? true,
            can_move_locomotives: can_move_locomotives || false,
            can_edit_catalog: can_edit_catalog || false,
            can_manage_users: can_manage_users || false,
            can_complete_remarks: can_complete_remarks ?? true,
            can_verify_remarks: can_verify_remarks || false
        };
        if (name) updates.name = name;
        if (description !== undefined) updates.description = description;

        const { data, error } = await supabase
            .from('roles')
            .update(updates)
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) {
            if (error.code === '23505') {
                return res.status(400).json({ error: 'Роль с таким названием уже существует' });
            }
            return res.status(500).json({ error: error.message });
        }
        res.json(data);
    },

    deleteRole: async (req, res) => {
        const { id } = req.params;

        // First check if it's admin role
        const { data: roleData } = await supabase.from('roles').select('*').eq('id', id).maybeSingle();
        if (roleData && roleData.name === 'admin') {
            return res.status(400).json({ error: 'Нельзя удалить роль admin' });
        }

        const { error } = await supabase.from('roles').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true, message: 'Role deleted' });
    }
};

module.exports = dictionaryController;
