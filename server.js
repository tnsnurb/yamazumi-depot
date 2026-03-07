require('dotenv').config();

// Bypass unauthorized SSL certs in local development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const supabase = require('./db');
const compression = require('compression');

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = 3000;

// Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(session({
    secret: 'yamazumi-depot-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Static files
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// Middleware
const { requireAuth, requireAdmin, requirePermission } = require('./src/middlewares/auth');

// Extracted Routers
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const remarksRoutes = require('./src/routes/remarks');
const locationsRoutes = require('./src/routes/locations');

// Mount API Routes
app.use('/api', authRoutes); // /api/me mounts here
app.use('/api/users', userRoutes); // User management + public users
app.use('/api/remarks', remarksRoutes);
app.use('/api/locations', locationsRoutes);


// ===================== AUDIT LOGS ROUTES =====================

app.get('/api/audit-logs', requireAdmin, async (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    let query = supabase
        .from('audit_logs')
        .select(`
            id, action, target, details, created_at,
            user:users!audit_logs_user_id_fkey(username, full_name, locations:locations(name))
        `, { count: 'exact' });

    // Optionally filter audit logs by location if we link users to location_id
    // For now we'll fetch all or filter by active_location_id using joined table:
    if (req.session.user.active_location_id && req.session.user.role !== 'admin') {
        query = query.eq('users.location_id', req.session.user.active_location_id);
    }

    const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ logs: data || [], total: count || 0 });
});

// ===================== CATALOG ROUTES =====================

app.get('/api/catalog', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('locomotive_catalog')
        .select('id, number')
        .order('number', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/catalog/manual', requireAdmin, async (req, res) => {
    const { number } = req.body;
    if (!number || !number.trim()) return res.status(400).json({ error: 'Номер локомотива обязателен' });

    const { data, error } = await supabase
        .from('locomotive_catalog')
        .insert([{ number: number.trim() }])
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
        target: number.trim(),
        details: `Каталог`
    });

    res.json(data);
});

app.put('/api/catalog/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { number } = req.body;
    if (!number || !number.trim()) return res.status(400).json({ error: 'Номер локомотива обязателен' });

    // Ensure it exists in catalog first to log old name
    const { data: oldData } = await supabase.from('locomotive_catalog').select('number').eq('id', id).maybeSingle();

    const { data, error } = await supabase
        .from('locomotive_catalog')
        .update({ number: number.trim() })
        .eq('id', id)
        .select()
        .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    // Audit Log
    await supabase.from('audit_logs').insert({
        user_id: req.session.user.id,
        action: 'Изменен локомотив в каталоге',
        target: number.trim(),
        details: `Было: ${oldData ? oldData.number : 'неизвестно'}`
    });

    res.json(data);
});

app.delete('/api/catalog/:id', requireAdmin, async (req, res) => {
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
});

app.post('/api/catalog/bulk', requireAdmin, async (req, res) => {
    const numbers = req.body;
    if (!Array.isArray(numbers) || numbers.length === 0) {
        return res.status(400).json({ error: 'Требуется массив номеров' });
    }

    const toInsert = numbers.map(n => ({
        number: typeof n === 'object' ? String(n.number || n['Номер'] || '').trim() : String(n).trim()
    })).filter(n => n.number);

    if (toInsert.length === 0) {
        return res.status(400).json({ error: 'Пустой список' });
    }

    const { data, error } = await supabase
        .from('locomotive_catalog')
        .upsert(toInsert, { onConflict: 'number', ignoreDuplicates: true })
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
});

// ===================== REMARK TEMPLATES ROUTES =====================

app.get('/api/remark-templates', requireAuth, async (req, res) => {
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
});

app.post('/api/remark-templates', requireAdmin, async (req, res) => {
    try {
        const { text, specialization, priority, category, estimated_hours } = req.body;
        console.log("POST /api/remark-templates - Body:", req.body);

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

        console.log("Template created successfully:", data.id);
        res.json(data);
    } catch (err) {
        console.error("Error creating template:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/remark-templates/bulk', requireAdmin, async (req, res) => {
    try {
        const templates = req.body;
        console.log(`POST /api/remark-templates/bulk - Received ${templates?.length} templates`);

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

        console.log(`Bulk templates inserted successfully: ${data ? data.length : 0} rows`);
        res.json({ success: true, count: data ? data.length : 0, data });
    } catch (err) {
        console.error("Error bulk creating templates:", err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/remark-templates/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { text, specialization, priority, category, estimated_hours } = req.body;
        console.log(`PUT /api/remark-templates/${id} - Body:`, req.body);

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

        console.log("Template updated successfully:", id);
        res.json(data);
    } catch (err) {
        console.error("Error updating template:", err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/remark-templates/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`DELETE /api/remark-templates/${id}`);

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

        console.log("Template deleted successfully:", id);
        res.json({ success: true });
    } catch (err) {
        console.error("Error deleting template:", err);
        res.status(500).json({ error: err.message });
    }
});

// ===================== REPAIR TYPES ROUTES =====================

app.get('/api/repair-types', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('repair_types')
        .select('id, name')
        .order('id', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/repair-types', requireAdmin, async (req, res) => {
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
});

app.delete('/api/repair-types/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('repair_types').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ===================== ROLES ROUTES (NEW) =====================

app.get('/api/roles', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('id', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/roles', requireAdmin, async (req, res) => {
    let { name, description, can_view_dashboard, can_view_map, can_view_journal, can_move_locomotives, can_edit_catalog, can_manage_users, can_complete_remarks, can_verify_remarks } = req.body;
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
});

app.put('/api/roles/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    let { name, description, can_view_dashboard, can_view_map, can_view_journal, can_move_locomotives, can_edit_catalog, can_manage_users, can_complete_remarks, can_verify_remarks } = req.body;

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
});

app.delete('/api/roles/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;

    // First check if it's admin role
    const { data: roleData } = await supabase.from('roles').select('*').eq('id', id).maybeSingle();
    if (roleData && roleData.name === 'admin') {
        return res.status(400).json({ error: 'Нельзя удалить роль admin' });
    }

    // Check if any users have this role mapping? We don't have hard FK but it's good practice. 
    // We'll skip deep FK constraint simulation for now, let Supabase/admin manage it.

    const { error } = await supabase.from('roles').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, message: 'Role deleted' });
});

// ===================== LOCOMOTIVE ROUTES =====================

app.get('/api/locomotives', requireAuth, async (req, res) => {
    let query = supabase
        .from('locomotives')
        .select('id, number, status, track, position, created_at, repair_type, planned_release, acceptance_time');

    if (req.session.user.active_location_id) {
        query = query.eq('location_id', req.session.user.active_location_id);
    }

    const { data, error } = await query
        .order('track')
        .order('position');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/locomotives/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const isIdNumeric = !isNaN(parseInt(id)) && /^\d+$/.test(id);

    let query = supabase.from('locomotives').select('*');
    if (isIdNumeric) {
        query = query.eq('id', id);
    } else {
        query = query.eq('number', decodeURIComponent(id));
    }

    const { data, error } = await query.maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Локомотив не найден' });
    res.json(data);
});

app.post('/api/locomotives', requirePermission('can_edit_catalog'), async (req, res) => {
    const { number, status, track, position, repair_type, planned_release, acceptance_time } = req.body;

    if (!number) {
        return res.status(400).json({ error: 'Номер локомотива обязателен' });
    }

    // Check if number already exists (only active locomotives in the same location)
    const { data: existing } = await supabase
        .from('locomotives')
        .select('id')
        .eq('number', number)
        .eq('location_id', req.session.user.active_location_id || 1)
        .neq('status', 'completed')
        .maybeSingle();

    if (existing) {
        return res.status(400).json({ error: 'Локомотив с таким номером уже существует' });
    }

    // Check if slot is occupied
    if (track && position) {
        const { data: occupied } = await supabase
            .from('locomotives')
            .select('id')
            .eq('track', track)
            .eq('position', position)
            .eq('location_id', req.session.user.active_location_id || 1)
            .maybeSingle();

        if (occupied) {
            return res.status(400).json({ error: 'Эта позиция уже занята' });
        }
    }

    try {
        const { data: loco, error } = await supabase
            .from('locomotives')
            .insert({
                number,
                status: status || 'active',
                track: track || null,
                position: position || null,
                repair_type: repair_type || null,
                planned_release: planned_release || null,
                acceptance_time: acceptance_time || new Date().toISOString(),
                location_id: req.session.user.active_location_id || 1
            })
            .select()
            .maybeSingle();

        if (error) throw error;

        // Log movement
        if (track && position) {
            await supabase.from('movements').insert({
                locomotive_id: loco.id,
                locomotive_number: number,
                from_track: null,
                from_position: null,
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
});

app.delete('/api/locomotives/:id', requirePermission('can_edit_catalog'), async (req, res) => {
    const id = parseInt(req.params.id);

    const { data: loco } = await supabase
        .from('locomotives')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (!loco) {
        return res.status(404).json({ error: 'Локомотив не найден' });
    }

    // Log removal
    await supabase.from('movements').insert({
        locomotive_id: loco.id,
        locomotive_number: loco.number,
        from_track: loco.track,
        from_position: loco.position,
        to_track: null,
        to_position: null,
        action: 'remove',
        moved_by: req.session.user.full_name || req.session.user.username,
        location_id: req.session.user.active_location_id || 1
    });

    const { error } = await supabase
        .from('locomotives')
        .delete()
        .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.put('/api/locomotives/:id/move', requirePermission('can_move_locomotives'), async (req, res) => {
    const id = parseInt(req.params.id);
    const { track, position, reason } = req.body;

    const { data: loco } = await supabase
        .from('locomotives')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (!loco) {
        return res.status(404).json({ error: 'Локомотив не найден' });
    }

    // Check if target slot is occupied
    if (track && position) {
        const { data: occupied } = await supabase
            .from('locomotives')
            .select('id')
            .eq('track', track)
            .eq('position', position)
            .eq('location_id', loco.location_id)
            .neq('id', id)
            .maybeSingle();

        if (occupied) {
            return res.status(400).json({ error: 'Эта позиция уже занята' });
        }
    }

    // Determine action type
    const isRemoveFromTrack = (track === null && position === null);
    const actionType = isRemoveFromTrack ? 'remove_from_track' : 'move';

    // Log movement
    await supabase.from('movements').insert({
        locomotive_id: loco.id,
        locomotive_number: loco.number,
        from_track: loco.track,
        from_position: loco.position,
        to_track: track,
        to_position: position,
        action: reason ? `${actionType}: ${reason}` : actionType,
        moved_by: req.session.user.full_name || req.session.user.username,
        location_id: req.session.user.active_location_id || 1
    });

    // Update position
    const { data: updated, error } = await supabase
        .from('locomotives')
        .update({ track, position })
        .eq('id', id)
        .select()
        .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    res.json(updated);
});

app.put('/api/locomotives/:id', requirePermission('can_edit_catalog'), async (req, res) => {
    const id = parseInt(req.params.id);
    const { status, number } = req.body;

    // Get current locomotive data
    const { data: loco } = await supabase
        .from('locomotives')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (!loco) return res.status(404).json({ error: 'Локомотив не найден' });

    const updates = {};
    if (number !== undefined) updates.number = number;
    if (status !== undefined) updates.status = status;
    if (req.body.repair_type !== undefined) updates.repair_type = req.body.repair_type;
    if (req.body.planned_release !== undefined) updates.planned_release = req.body.planned_release;
    if (req.body.acceptance_time !== undefined) updates.acceptance_time = req.body.acceptance_time;

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
    }

    const { data: updated, error } = await supabase
        .from('locomotives')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!updated) return res.status(404).json({ error: 'Локомотив не найден' });
    res.json(updated);
});

// ===================== MOVEMENT JOURNAL =====================

app.get('/api/movements', requireAuth, async (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const { startDate, endDate, user, loco, action } = req.query;

    let query = supabase.from('movements').select('*', { count: 'exact' });

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
});

app.get('/api/movements/stats', requireAuth, async (req, res) => {
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
});

app.get('/api/movements/users', requireAuth, async (req, res) => {
    // Note: PostgREST doesn't support SELECT DISTINCT natively via simple chain,
    // so we can just grab them and deduplicate in Node, or use an RPC if available.
    // Given the scale, fetching and deduplicating in Node is fine for now, or using a quick trick.
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
});

// ===================== LOCOMOTIVE HISTORY =====================

app.get('/api/movements/by-locomotive/:number', requireAuth, async (req, res) => {
    const locoNumber = decodeURIComponent(req.params.number);
    const { data: movements, error } = await supabase
        .from('movements')
        .select('*')
        .eq('locomotive_number', locoNumber)
        .order('moved_at', { ascending: false })
        .limit(500);

    if (error) return res.status(500).json({ error: error.message });
    res.json(movements || []);
});

// ===================== LOCOMOTIVE REMARKS =====================

app.get('/api/locomotives/:id/remarks', requireAuth, async (req, res) => {
    const { id } = req.params;
    const isIdNumeric = !isNaN(parseInt(id)) && /^\d+$/.test(id);

    let locoId;
    if (isIdNumeric) {
        locoId = parseInt(id);
    } else {
        const { data: locoData } = await supabase.from('locomotives').select('id').eq('number', decodeURIComponent(id)).maybeSingle();
        if (!locoData) return res.status(404).json({ error: 'Локомотив не найден' });
        locoId = locoData.id;
    }

    const { data: remarks, error } = await supabase
        .from('locomotive_remarks')
        .select(`
            *,
            completed_by:users!locomotive_remarks_completed_by_fkey (
                full_name,
                username
            ),
            created_by:users!locomotive_remarks_created_by_fkey (
                full_name,
                username
            )
        `)
        .eq('locomotive_id', locoId)
        .order('is_completed', { ascending: true })
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(remarks || []);
});



app.post('/api/locomotives/:id/remarks', requirePermission('can_edit_catalog'), async (req, res) => {
    const { id } = req.params;
    const isIdNumeric = !isNaN(parseInt(id)) && /^\d+$/.test(id);

    let locoId;
    if (isIdNumeric) {
        locoId = parseInt(id);
    } else {
        const { data: locoData } = await supabase.from('locomotives').select('id').eq('number', decodeURIComponent(id)).maybeSingle();
        if (!locoData) return res.status(404).json({ error: 'Локомотив не найден' });
        locoId = locoData.id;
    }

    const { text, priority, category } = req.body;
    if (!text) return res.status(400).json({ error: 'Текст замечания обязателен' });

    const { data: loco } = await supabase.from('locomotives').select('number').eq('id', locoId).maybeSingle();

    const { data, error } = await supabase
        .from('locomotive_remarks')
        .insert({
            locomotive_id: locoId,
            text,
            priority: priority || 'medium',
            category: category || null,
            created_by: req.session.user.id
        })
        .select(`
            *,
            created_by:users!locomotive_remarks_created_by_fkey(full_name, username)
        `)
        .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    if (loco) {
        await supabase.from('movements').insert({
            locomotive_id: locoId,
            locomotive_number: loco.number,
            action: `remark_added: ${text}`,
            moved_by: req.session.user.full_name || req.session.user.username
        });
    }

    res.json(data);
});

app.post('/api/locomotives/:id/remarks/template', requirePermission('can_edit_catalog'), async (req, res) => {
    const { id } = req.params;
    const { template_id } = req.body;
    if (!template_id) return res.status(400).json({ error: 'ID шаблона обязателен' });

    const isIdNumeric = !isNaN(parseInt(id)) && /^\d+$/.test(id);

    try {
        let locoId;
        let locoQuery;

        if (isIdNumeric) {
            locoId = parseInt(id);
            locoQuery = supabase.from('locomotives').select('number').eq('id', locoId).maybeSingle();
        } else {
            locoQuery = supabase.from('locomotives').select('id, number').eq('number', decodeURIComponent(id)).maybeSingle();
        }

        // Parallelize fetching template and locomotive info
        const [templateRes, locoRes] = await Promise.all([
            supabase.from('remark_templates').select('*').eq('id', template_id).maybeSingle(),
            locoQuery
        ]);

        if (templateRes.error) throw templateRes.error;
        if (!templateRes.data) return res.status(404).json({ error: 'Шаблон не найден' });

        if (locoRes.error) throw locoRes.error;
        if (!locoRes.data) return res.status(404).json({ error: 'Локомотив не найден' });

        const template = templateRes.data;
        const loco = locoRes.data;
        if (!isIdNumeric) locoId = loco.id;

        // Insert remark and get returned data
        const { data, error } = await supabase
            .from('locomotive_remarks')
            .insert({
                locomotive_id: locoId,
                text: template.text,
                priority: template.priority || 'medium',
                category: template.category || null,
                points: template.points || 10,
                estimated_hours: template.estimated_hours || 0,
                created_by: req.session.user.id
            })
            .select(`
                *,
                created_by:users!locomotive_remarks_created_by_fkey(full_name, username)
            `)
            .maybeSingle();

        if (error) throw error;

        // Parallelize side-effects: update usage count and log movement
        Promise.all([
            supabase.rpc('increment_template_usage', { t_id: template_id }),
            supabase.from('movements').insert({
                locomotive_id: locoId,
                locomotive_number: loco.number,
                action: `remark_added_from_template: ${template.text}`,
                moved_by: req.session.user.full_name || req.session.user.username
            })
        ]).catch(err => console.error("Side effect error (non-blocking):", err));

        res.json(data);
    } catch (err) {
        console.error("Template add error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/locomotives/:id/remarks/bulk', requirePermission('can_edit_catalog'), async (req, res) => {
    const { id } = req.params;
    const isIdNumeric = !isNaN(parseInt(id)) && /^\d+$/.test(id);

    let locoId;
    if (isIdNumeric) {
        locoId = parseInt(id);
    } else {
        const { data: locoData } = await supabase.from('locomotives').select('id').eq('number', decodeURIComponent(id)).maybeSingle();
        if (!locoData) return res.status(404).json({ error: 'Локомотив не найден' });
        locoId = locoData.id;
    }

    const { texts } = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
        return res.status(400).json({ error: 'Необходим массив строк замечаний' });
    }

    // Fetch loco number for logging
    const { data: loco } = await supabase.from('locomotives').select('number').eq('id', locoId).maybeSingle();

    const payload = texts.map(t => ({
        locomotive_id: locoId,
        text: t,
        created_by: req.session.user.id
    }));

    const { data, error } = await supabase
        .from('locomotive_remarks')
        .insert(payload)
        .select();

    if (error) return res.status(500).json({ error: error.message });

    // Log to movements
    if (loco) {
        await supabase.from('movements').insert({
            locomotive_id: locoId,
            locomotive_number: loco.number,
            action: `remark_added: ${texts.length} замечаний`,
            moved_by: req.session.user.full_name || req.session.user.username
        });
    }

    res.json(data);
});

app.put('/api/remarks/:id/complete', requirePermission('can_complete_remarks'), async (req, res) => {
    const remarkId = req.params.id;
    const { is_completed, completion_photo_url } = req.body;

    try {
        // Fetch remark to get point value and current status
        const { data: remark, error: fetchErr } = await supabase
            .from('locomotive_remarks')
            .select('*, locomotive:locomotives(number)')
            .eq('id', remarkId)
            .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!remark) return res.status(404).json({ error: 'Замечание не найдено' });

        // Only update if status changed
        if (remark.is_completed === is_completed) {
            return res.json(remark);
        }

        const updates = {
            is_completed: is_completed,
            completed_by: is_completed ? req.session.user.id : null,
            completed_at: is_completed ? new Date().toISOString() : null
        };

        // When reopening a remark, ensure it loses verified status
        if (!is_completed) {
            updates.is_verified = false;
            updates.verified_by = null;
            updates.verified_at = null;
        }
        if (completion_photo_url) updates.completion_photo_url = completion_photo_url;

        const { data: updatedRemark, error: updateErr } = await supabase
            .from('locomotive_remarks')
            .update(updates)
            .eq('id', remarkId)
            .select(`
                *,
                completed_by: users!locomotive_remarks_completed_by_fkey(full_name, username),
                created_by: users!locomotive_remarks_created_by_fkey(full_name, username)
            `)
            .maybeSingle();

        if (updateErr) throw updateErr;

        // --- POINT SYSTEM LOGIC ---
        const pointsToAward = remark.points || 10;
        const userId = req.session.user.id;

        if (is_completed) {
            // Increment user points
            await supabase.rpc('increment_user_points', { user_id: userId, amount: pointsToAward });
        } else {
            // Decrement user points if reopened
            await supabase.rpc('increment_user_points', { user_id: userId, amount: -pointsToAward });
        }

        // --- LOGGING ---
        await supabase.from('remark_history').insert({
            remark_id: remarkId,
            user_id: req.session.user.id,
            action: is_completed ? 'completed' : 'reopened',
            details: is_completed ? `Выполнено (+${pointsToAward} б.)` : `Отметка снята (-${pointsToAward} б.)`
        });

        if (remark.locomotive) {
            await supabase.from('movements').insert({
                locomotive_id: remark.locomotive_id,
                locomotive_number: remark.locomotive.number,
                action: is_completed ? `remark_completed: ${remark.text}` : `remark_reopened: ${remark.text}`,
                moved_by: req.session.user.full_name || req.session.user.username
            });
        }

        res.json(updatedRemark);
    } catch (err) {
        console.error("Error in completion logic:", err);
        res.status(500).json({ error: err.message });
    }
});

// New Verify Route
app.put('/api/remarks/:id/verify', requirePermission('can_verify_remarks'), async (req, res) => {
    const remarkId = req.params.id;

    try {
        const { data: remark, error: fetchErr } = await supabase
            .from('locomotive_remarks')
            .select('*, locomotive:locomotives(number)')
            .eq('id', remarkId)
            .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!remark) return res.status(404).json({ error: 'Замечание не найдено' });
        if (!remark.is_completed) return res.status(400).json({ error: 'Замечание еще не выполнено электриком' });

        const updates = {
            is_verified: true,
            verified_by: req.session.user.id,
            verified_at: new Date().toISOString()
        };

        const { data: updatedRemark, error: updateErr } = await supabase
            .from('locomotive_remarks')
            .update(updates)
            .eq('id', remarkId)
            .select(`
                *,
                completed_by: users!locomotive_remarks_completed_by_fkey(full_name, username),
                created_by: users!locomotive_remarks_created_by_fkey(full_name, username),
                verified_by: users!locomotive_remarks_verified_by_fkey(full_name, username)
            `)
            .maybeSingle();

        if (updateErr) throw updateErr;

        // --- LOGGING ---
        await supabase.from('remark_history').insert({
            remark_id: remarkId,
            user_id: req.session.user.id,
            action: 'verified',
            details: 'Проверено и принято'
        });

        if (remark.locomotive) {
            await supabase.from('movements').insert({
                locomotive_id: remark.locomotive_id,
                locomotive_number: remark.locomotive.number,
                action: `remark_verified: ${remark.text}`,
                moved_by: req.session.user.full_name || req.session.user.username
            });
        }

        res.json(updatedRemark);
    } catch (err) {
        console.error("Error in verification logic:", err);
        res.status(500).json({ error: err.message });
    }
});

// New Reject Route
app.put('/api/remarks/:id/reject', requirePermission('can_verify_remarks'), async (req, res) => {
    const remarkId = req.params.id;
    const { comment } = req.body;

    try {
        const { data: remark, error: fetchErr } = await supabase
            .from('locomotive_remarks')
            .select('*, locomotive:locomotives(number)')
            .eq('id', remarkId)
            .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!remark) return res.status(404).json({ error: 'Замечание не найдено' });
        if (!remark.is_completed) return res.status(400).json({ error: 'Замечание еще не выполнено электриком' });

        const updates = {
            is_completed: false, // Return to worker
            completed_by: null,
            completed_at: null,
            is_verified: false,
            verified_by: null,
            verified_at: null
        };

        const { data: updatedRemark, error: updateErr } = await supabase
            .from('locomotive_remarks')
            .update(updates)
            .eq('id', remarkId)
            .select(`
                *,
                assigned_user: users!locomotive_remarks_assigned_to_fkey(full_name, username),
                created_by: users!locomotive_remarks_created_by_fkey(full_name, username)
                    `)
            .maybeSingle();

        if (updateErr) throw updateErr;

        // --- POINT SYSTEM LOGIC ---
        // Deduct points from the user who originally completed it
        const pointsToAward = remark.points || 10;
        if (remark.completed_by) {
            await supabase.rpc('increment_user_points', { user_id: remark.completed_by, amount: -pointsToAward });
        }

        // --- LOGGING ---
        const rejectionDetails = [
            `Отклонено и возвращено в работу (-${pointsToAward} б.)`,
            comment ? `Комментарий: "${comment}"` : null
        ].filter(Boolean).join(' | ');

        await supabase.from('remark_history').insert({
            remark_id: remarkId,
            user_id: req.session.user.id,
            action: 'rejected',
            details: rejectionDetails
        });

        if (remark.locomotive) {
            const movementAction = [
                `remark_rejected: ${remark.text}`,
                comment ? `(Причина: ${comment})` : null
            ].filter(Boolean).join(' ');

            await supabase.from('movements').insert({
                locomotive_id: remark.locomotive_id,
                locomotive_number: remark.locomotive.number,
                action: movementAction,
                moved_by: req.session.user.full_name || req.session.user.username
            });
        }

        res.json(updatedRemark);
    } catch (err) {
        console.error("Error in rejection logic:", err);
        res.status(500).json({ error: err.message });
    }
});

// New Assignment Route
app.put('/api/remarks/:id/assign', requirePermission('can_complete_remarks'), async (req, res) => {
    const remarkId = req.params.id;
    const { assigned_to } = req.body;

    try {
        const { data: remark, error: fetchErr } = await supabase
            .from('locomotive_remarks')
            .select('text')
            .eq('id', remarkId)
            .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!remark) return res.status(404).json({ error: 'Замечание не найдено' });

        const { data: updated, error: updateErr } = await supabase
            .from('locomotive_remarks')
            .update({ assigned_to: assigned_to || null })
            .eq('id', remarkId)
            .select(`
            *,
                assigned_user: users!locomotive_remarks_assigned_to_fkey(full_name, username, specialization)
                `)
            .maybeSingle();

        if (updateErr) throw updateErr;

        // Log to history
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
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/remarks/:id', requirePermission('can_complete_remarks'), async (req, res) => {
    const remarkId = req.params.id;
    const { text, priority, category } = req.body;

    const updates = {};
    if (text !== undefined) updates.text = text;
    if (priority !== undefined) updates.priority = priority;
    if (category !== undefined) updates.category = category;

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Нет данных для обновления' });

    const { data, error } = await supabase
        .from('locomotive_remarks')
        .update(updates)
        .eq('id', remarkId)
        .select(`
            id, text, is_completed, completed_at, created_at, priority, category, locomotive_id,
                completed_by: users!locomotive_remarks_completed_by_fkey(full_name, username),
                created_by: users!locomotive_remarks_created_by_fkey(full_name, username)
                `);

    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Замечание не найдено' });

    // Ensure we log to the new history table
    try {
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
    } catch (logErr) { }

    res.json(data[0]);
});

// ===================== REMARK COMMENTS, PHOTOS, HISTORY =====================

app.get('/api/remarks/:id/history', requireAuth, async (req, res) => {
    const remarkId = req.params.id;

    const { data, error } = await supabase
        .from('remark_history')
        .select(`
            id, action, details, created_at,
                user_id: users(full_name, username)
                `)
        .eq('remark_id', remarkId)
        .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

app.post('/api/remarks/:id/photos', requireAuth, upload.single('photo'), async (req, res) => {
    const remarkId = req.params.id;
    if (!req.file) return res.status(400).json({ error: 'Нет файла' });

    try {
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
        const filePath = `remarks / ${remarkId} / ${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('remark_attachments')
            .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

        if (uploadError) throw new Error(uploadError.message);

        const { data: publicData } = supabase.storage
            .from('remark_attachments')
            .getPublicUrl(filePath);

        const { data, error } = await supabase
            .from('remark_photos')
            .insert({
                remark_id: remarkId,
                user_id: req.session.user.id,
                photo_url: publicData.publicUrl
            })
            .select(`
                id, photo_url, created_at,
                user_id: users(full_name, username)
                `)
            .maybeSingle();

        if (error) throw new Error(error.message);

        // log to history
        await supabase.from('remark_history').insert({
            remark_id: remarkId,
            user_id: req.session.user.id,
            action: 'photo_added',
            details: 'Добавлено фото'
        });

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/remarks/:id/photos', requireAuth, async (req, res) => {
    const remarkId = req.params.id;

    const { data, error } = await supabase
        .from('remark_photos')
        .select(`
            id, photo_url, created_at,
                user_id: users(full_name, username)
                `)
        .eq('remark_id', remarkId)
        .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

app.get('/api/remarks/:id/comments', requireAuth, async (req, res) => {
    const remarkId = req.params.id;

    const { data, error } = await supabase
        .from('remark_comments')
        .select(`
            id, text, created_at,
                user_id: users(full_name, username)
                `)
        .eq('remark_id', remarkId)
        .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

app.post('/api/remarks/:id/comments', requireAuth, async (req, res) => {
    const remarkId = req.params.id;
    const { text } = req.body;

    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Текст комментария обязателен' });
    }

    const { data, error } = await supabase
        .from('remark_comments')
        .insert({
            remark_id: remarkId,
            user_id: req.session.user.id,
            text: text.trim()
        })
        .select(`
            id, text, created_at,
                user_id: users(full_name, username)
                `)
        .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ===================== DASHBOARD CHART DATA =====================

app.get('/api/dashboard/chart', requireAuth, async (req, res) => {
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

        // Average repair time (from 'add' to 'remove_from_track' for same locomotive)
        let allMQuery = supabase
            .from('movements')
            .select('locomotive_number, action, moved_at')
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
});

// ===================== DASHBOARD STATS =====================

app.get('/api/dashboard', requireAuth, async (req, res) => {
    try {
        const showAllLocations = req.query.all_locations === 'true' && req.session.user.is_global_admin;

        // Total locomotives
        let locQuery1 = supabase.from('locomotives').select('*', { count: 'exact', head: true });
        if (!showAllLocations && req.session.user.active_location_id) locQuery1 = locQuery1.eq('location_id', req.session.user.active_location_id);
        const { count: totalLocos } = await locQuery1;

        // On tracks
        let locQuery2 = supabase.from('locomotives').select('id, status, track').not('track', 'is', null);
        if (!showAllLocations && req.session.user.active_location_id) locQuery2 = locQuery2.eq('location_id', req.session.user.active_location_id);
        const { data: onTracks } = await locQuery2;

        // Status breakdown
        const statusCounts = { active: 0, repair: 0, waiting: 0, completed: 0 };
        const trackOccupancy = {};
        (onTracks || []).forEach(l => {
            statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
            trackOccupancy[l.track] = (trackOccupancy[l.track] || 0) + 1;
        });

        // Track utilization (6 slots per track × 6 tracks = 36 total slots)
        const totalSlots = 36;
        const occupiedSlots = (onTracks || []).length;

        // Movements today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let mTodayQ = supabase.from('movements').select('*', { count: 'exact', head: true }).gte('moved_at', today.toISOString());
        if (!showAllLocations && req.session.user.active_location_id) mTodayQ = mTodayQ.eq('location_id', req.session.user.active_location_id);
        const { count: movementsToday } = await mTodayQ;

        // Movements this week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        let mWeekQ = supabase.from('movements').select('*', { count: 'exact', head: true }).gte('moved_at', weekAgo.toISOString());
        if (!showAllLocations && req.session.user.active_location_id) mWeekQ = mWeekQ.eq('location_id', req.session.user.active_location_id);
        const { count: movementsWeek } = await mWeekQ;

        res.json({
            totalLocomotives: totalLocos || 0,
            onTracks: occupiedSlots,
            totalSlots,
            statusCounts,
            trackOccupancy,
            movementsToday: movementsToday || 0,
            movementsWeek: movementsWeek || 0,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===================== JOURNAL EXPORT =====================

app.get('/api/movements/export', requireAuth, async (req, res) => {
    try {
        const { startDate, endDate, user, loco, action } = req.query;
        console.log(`📊 Exporting movements: User = ${req.session.user.username}, Filters = `, req.query);

        let query = supabase.from('movements').select('*').order('moved_at', { ascending: false });

        if (startDate) {
            query = query.gte('moved_at', `${startDate}T00:00:00.000Z`);
        }
        if (endDate) {
            query = query.lte('moved_at', `${endDate}T23: 59: 59.999Z`);
        }
        if (user && user !== 'all') {
            query = query.eq('moved_by', user);
        }
        if (loco) {
            query = query.ilike('locomotive_number', `% ${loco} % `);
        }
        if (action && action !== 'all') {
            if (action === 'remove_from_track' || action === 'status_change' || action === 'remark') {
                query = query.like('action', `${action === 'remark' ? 'remark_%' : action + '%'} `);
            } else {
                query = query.eq('action', action);
            }
        }

        const showAllLocations = req.query.all_locations === 'true' && req.session.user.is_global_admin;
        if (!showAllLocations && req.session.user.active_location_id) {
            query = query.eq('location_id', req.session.user.active_location_id);
        }

        const { data: movements, error } = await query.limit(10000);

        if (error) {
            console.error("❌ Export query error:", error);
            return res.status(500).json({ error: error.message });
        }

        // Build CSV
        const actionLabels = {
            'add': 'Добавлен',
            'move': 'Перемещён',
            'remove': 'Удалён',
        };

        const header = '№;Дата;Локомотив;Действие;Откуда;Куда;Пользователь\n';
        const rows = (movements || []).map((m, i) => {
            let actionStr = m.action || '—';
            if (actionStr.startsWith('remove_from_track')) {
                actionStr = 'Убран с пути: ' + (actionStr.includes(': ') ? actionStr.split(': ').slice(1).join(': ') : '');
            } else if (actionLabels[actionStr]) {
                actionStr = actionLabels[actionStr];
            } else {
                // Handle complex actions like status_change: Repair → Active
                actionStr = actionStr.replace('status_change:', 'Смена статуса:').replace('remark_added:', 'Добавлено замечание:').replace('remark_completed:', 'Замечание выполнено:');
            }

            const from = m.from_track ? `Путь ${m.from_track}, Слот ${m.from_position} ` : '—';
            const to = m.to_track ? `Путь ${m.to_track}, Слот ${m.to_position} ` : '—';
            const date = m.moved_at ? new Date(m.moved_at).toLocaleString('ru-RU') : '—';
            const userStr = (m.moved_by || '—').replace(/;/g, ','); // Safety check for CSV separator
            const locoStr = (m.locomotive_number || '—').replace(/;/g, ',');
            const cleanAction = actionStr.replace(/;/g, ',');

            return `${i + 1};${date};${locoStr};${cleanAction};${from};${to};${userStr} `;
        }).join('\n');

        const bom = '\ufeff'; // for Excel UTF-8 support
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=journal_export.csv');
        console.log(`✅ Export completed: ${movements?.length || 0} rows sent.`);
        res.send(bom + header + rows);
    } catch (err) {
        console.error("❌ Export critical error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ===================== USER PROFILE =====================

app.put('/api/profile/password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // In many recovery scenarios (Magic Link, Reset Password link), 
    // the user might not have/know their "current" password.
    // We allow skipping currentPassword if they are authenticated via a recovery flow.
    const isRecoveryFlow = req.headers['x-auth-recovery'] === 'true';

    if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ error: 'Новый пароль должен быть минимум 4 символа' });
    }

    try {
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.session.user.id)
            .maybeSingle();

        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        // If not in recovery flow, we MUST check currentPassword
        if (!isRecoveryFlow) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Укажите текущий пароль' });
            }
            // Check against stored bcrypt hash if it exists
            if (user.password) {
                const validPassword = await bcrypt.compare(currentPassword, user.password);
                if (!validPassword) {
                    return res.status(400).json({ error: 'Неверный текущий пароль' });
                }
            }
        }

        // 1. Update in Supabase Auth (Primary)
        if (user.uuid) {
            const { error: authError } = await supabase.auth.admin.updateUserById(
                user.uuid,
                { password: newPassword }
            );
            if (authError) {
                console.error("❌ Auth update error:", authError);
                return res.status(400).json({ error: `Ошибка Supabase Auth: ${authError.message} ` });
            }
        }

        // 2. Update in legacy public.users (Optional/Sync)
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const { error: dbError } = await supabase
            .from('users')
            .update({ password: hashedPassword })
            .eq('id', req.session.user.id);

        if (dbError) {
            console.error("❌ DB update error:", dbError);
            return res.status(500).json({ error: 'Ошибка обновления пароля в БД' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("❌ Password change exception:", err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});


// ===================== KIOSK ROUTES =====================





// ===================== PAGE ROUTES =====================

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

// ===================== STARTUP =====================



app.listen(PORT, () => {
    console.log(`🚂 Yamazumi Depot Server running at http://localhost:${PORT}`);
    console.log(`📦 Database: Supabase (${process.env.SUPABASE_URL})`);
});
