require('dotenv').config();
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

function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ error: 'Forbidden: Admins only' });
}

function requirePermission(permissionStr) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (req.session.user.role === 'admin') return next();
        if (req.session.user.permissions && req.session.user.permissions[permissionStr]) {
            return next();
        }
        return res.status(403).json({ error: 'Доступ запрещен' });
    };
}

// ===================== AUTH ROUTES =====================

// Step 1: Verify barcode — return user info, do NOT log in yet
app.post('/api/login/barcode', async (req, res) => {
    const { barcode } = req.body;
    console.log("\n=== BARCODE SCAN ATTEMPT ===");
    console.log("Received barcode:", JSON.stringify(barcode));

    if (!barcode) return res.status(400).json({ error: 'Код не считан' });
    // Remove extra quotes that the scanner might add
    const cleanBarcode = String(barcode).trim().replace(/^"|"$/g, '');

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, full_name, avatar_url')
            .eq('barcode', cleanBarcode)
            .maybeSingle();

        console.log("Supabase search result - User:", user?.username, "Error:", error);

        if (error || !user) {
            return res.status(401).json({ error: 'Пользователь с таким кодом не найден' });
        }

        // Return user info for PIN prompt (don't log in yet)
        res.json({ found: true, user: { id: user.id, full_name: user.full_name, avatar_url: user.avatar_url } });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Step 2: Verify PIN code — log in
app.post('/api/login/barcode/pin', async (req, res) => {
    const { barcode, pin } = req.body;

    console.log("\n=== PIN VERIFICATION ATTEMPT ===");
    console.log("Received barcode for PIN:", JSON.stringify(barcode), "PIN:", pin);

    if (!barcode || !pin) return res.status(400).json({ error: 'Введите пин-код' });

    // Clean barcode just in case
    const cleanBarcode = String(barcode).trim().replace(/^"|"$/g, '');

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, full_name, role, avatar_url, pin_code, location_id, is_global_admin')
            .eq('barcode', cleanBarcode)
            .maybeSingle();

        console.log("PIN verification - User found:", user?.username, "Error:", error);

        if (error || !user) {
            return res.status(401).json({ error: 'Пользователь не найден' });
        }

        if (!user.pin_code || user.pin_code !== pin) {
            return res.status(401).json({ error: 'Неверный пин-код' });
        }

        // Fetch role permissions
        const { data: roleData } = await supabase
            .from('roles')
            .select('*')
            .eq('name', user.role)
            .maybeSingle();

        req.session.user = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            avatar_url: user.avatar_url,
            pin_code: user.pin_code,
            location_id: user.location_id,
            active_location_id: user.location_id, // Default to their assigned location
            is_global_admin: user.is_global_admin,
            permissions: roleData || {}
        };

        res.json({ success: true, user: req.session.user });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('id, username, password, full_name, role, avatar_url, pin_code, location_id, is_global_admin')
        .eq('username', username)
        .maybeSingle();

    if (error || !user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const { data: roleData } = await supabase
        .from('roles')
        .select('*')
        .eq('name', user.role)
        .maybeSingle();

    req.session.user = {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        avatar_url: user.avatar_url,
        pin_code: user.pin_code,
        location_id: user.location_id,
        active_location_id: user.location_id, // Default to their assigned location
        is_global_admin: user.is_global_admin,
        permissions: roleData || {}
    };
    res.json({ success: true, user: req.session.user });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/me', (req, res) => {
    if (req.session && req.session.user) {
        return res.json({ authenticated: true, user: req.session.user });
    }
    res.json({ authenticated: false });
});

// Switch active location (for Global Admins)
app.put('/api/me/active-location', requireAuth, (req, res) => {
    const { location_id } = req.body;

    if (!req.session.user.is_global_admin) {
        return res.status(403).json({ error: 'Нет прав на смену локации (необходимы права Главного Администратора)' });
    }
    if (location_id === undefined) {
        return res.status(400).json({ error: 'Не указана локация' });
    }

    req.session.user.active_location_id = location_id || null;
    res.json({ success: true, active_location_id: location_id || null });
});

// Get all remarks (for overall dashboard/worker tasks)
app.get('/api/remarks', requireAuth, async (req, res) => {
    console.log(`\n=== REMARKS FEED REQUEST ===`);
    console.log(`User: ${req.session.user.username} (Global Admin: ${req.session.user.is_global_admin})`);
    console.log(`Active Location: ${req.session.user.active_location_id}`);

    const { is_completed, locomotive_id } = req.query;
    console.log(`Filters - completed: ${is_completed}, loco: ${locomotive_id}`);

    try {
        let query = supabase
            .from('locomotive_remarks')
            .select(`
                *,
                locomotive:locomotives(number, location_id),
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
        if (locomotive_id) {
            query = query.eq('locomotive_id', locomotive_id);
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

        console.log(`Returning ${filteredResults.length} remarks`);
        res.json(filteredResults);
    } catch (err) {
        console.error("General error in /api/remarks:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all locations
app.get('/api/locations', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('id');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Create new location
app.post('/api/locations', requireAuth, async (req, res) => {
    if (!req.session.user.is_global_admin) {
        return res.status(403).json({ error: 'Только Главный Админ может создавать депо' });
    }
    const { name, track_count, slot_count, gate_position, track_config } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Название обязательно' });

    const insertData = { name: name.trim() };
    if (track_count !== undefined) insertData.track_count = parseInt(track_count) || 6;
    if (slot_count !== undefined) insertData.slot_count = parseInt(slot_count) || 6;
    if (gate_position !== undefined) insertData.gate_position = gate_position;
    if (track_config !== undefined) insertData.track_config = track_config;

    const { data, error } = await supabase.from('locations').insert([insertData]).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Update location
app.put('/api/locations/:id', requireAuth, async (req, res) => {
    if (!req.session.user.is_global_admin) {
        return res.status(403).json({ error: 'Только Главный Админ может изменять депо' });
    }
    const { id } = req.params;
    const { name, is_active, track_count, slot_count, gate_position, track_config } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (is_active !== undefined) updateData.is_active = is_active;
    if (track_count !== undefined) updateData.track_count = parseInt(track_count) || 6;
    if (slot_count !== undefined) updateData.slot_count = parseInt(slot_count) || 6;
    if (gate_position !== undefined) updateData.gate_position = gate_position;
    if (track_config !== undefined) updateData.track_config = track_config;

    console.log(`\n=== UPDATE LOCATION ATTEMPT (ID: ${id}) ===`);
    console.log("Payload:", JSON.stringify(updateData, null, 2));

    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    const { data, error } = await supabase
        .from('locations')
        .update(updateData)
        .eq('id', id)
        .select()
        .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Локация не найдена' });
    res.json(data);
});

app.post('/api/profile/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }

    try {
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `${req.session.user.id}_${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true
            });

        if (uploadError) {
            console.error("Storage upload error:", uploadError);
            return res.status(500).json({ error: 'Ошибка сохранения файла' });
        }

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        // Update user row
        const { error: dbError } = await supabase
            .from('users')
            .update({ avatar_url: publicUrl })
            .eq('id', req.session.user.id);

        if (dbError) {
            console.error("DB update error:", dbError);
            return res.status(500).json({ error: 'Ошибка обновления профиля' });
        }

        // Update session
        req.session.user.avatar_url = publicUrl;

        res.json({ success: true, avatar_url: publicUrl });
    } catch (err) {
        console.error("Avatar upload exception:", err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Update own profile (PIN code, password)
app.put('/api/profile', requireAuth, async (req, res) => {
    const userId = req.session.user.id;
    const { password, pin_code } = req.body;

    const updates = {};
    if (password) updates.password = bcrypt.hashSync(password, 10);
    if (pin_code !== undefined) updates.pin_code = pin_code || null; // allow clearing PIN

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select('id, username, full_name, avatar_url, pin_code')
            .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });

        // Update session
        if (pin_code !== undefined) {
            req.session.user.pin_code = pin_code || null;
        }
        res.json({ success: true, user: data });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Public endpoint to get list of users for terminal mode login
app.get('/api/public/users', async (req, res) => {
    let query = supabase
        .from('users')
        .select(`
            id,
            username,
            full_name,
            role,
            avatar_url
        `)
        .eq('is_active', true)
        .order('full_name', { ascending: true });

    if (req.query.location_id) {
        query = query.eq('location_id', parseInt(req.query.location_id));
    }

    const { data: users, error } = await query;

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    const publicUsers = users.map(u => ({
        username: u.username,
        full_name: u.full_name || u.username,
        role_name: u.role || 'Сотрудник',
        avatar_url: u.avatar_url
    }));

    res.json(publicUsers);
});

// ===================== USER MANAGEMENT ROUTES (ADMIN) =====================

app.get('/api/users', requireAdmin, async (req, res) => {
    let query = supabase
        .from('users')
        .select('id, username, full_name, role, created_at, barcode, is_active')
        .order('id');

    if (req.session.user.active_location_id) {
        query = query.eq('location_id', req.session.user.active_location_id);
    }
    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/users', requireAdmin, async (req, res) => {
    const { username, password, full_name, role, barcode, location_id } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });

    // Check if user exists
    const { data: existing } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
    if (existing) return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    const { data, error } = await supabase
        .from('users')
        .insert({
            username,
            password: hashedPassword,
            full_name: full_name || null,
            role: role || 'employee',
            barcode: barcode || null,
            location_id: req.session.user.is_global_admin ? (location_id || 1) : req.session.user.location_id
        })
        .select('id, username, full_name, role, created_at, barcode, location_id')
        .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    // Audit Log
    await supabase.from('audit_logs').insert({
        user_id: req.session.user.id,
        action: 'Создан пользователь',
        target: username,
        details: `Роль: ${role}, ФИО: ${full_name}`
    });

    res.json(data);
});

app.put('/api/users/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const { username, full_name, role, password, barcode, is_active, location_id } = req.body;

    // Protect modifying the main admin
    const { data: user } = await supabase.from('users').select('username').eq('id', id).maybeSingle();
    if (user && user.username === 'admin' && role && role !== 'admin') {
        return res.status(400).json({ error: 'Нельзя изменить роль главному администратору' });
    }
    if (user && user.username === 'admin' && is_active === false) {
        return res.status(400).json({ error: 'Нельзя заблокировать главного администратора' });
    }

    const updates = {};
    if (username !== undefined) updates.username = username;
    if (full_name !== undefined) updates.full_name = full_name;
    if (role !== undefined) updates.role = role;
    if (password) updates.password = bcrypt.hashSync(password, 10);
    if (barcode !== undefined) updates.barcode = barcode || null;
    if (is_active !== undefined) updates.is_active = is_active;
    if (location_id !== undefined && req.session.user.is_global_admin) {
        updates.location_id = location_id;
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select('id, username, full_name, role, created_at, barcode, is_active, location_id')
        .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    // Audit Log
    const changedFields = Object.keys(updates).filter(k => k !== 'password').join(', ');
    await supabase.from('audit_logs').insert({
        user_id: req.session.user.id,
        action: 'Изменен пользователь',
        target: data.username,
        details: `Поля: ${changedFields} ${password ? '+ Пароль' : ''}`
    });

    res.json(data);
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);

    // Protect deleting the main admin
    const { data: user } = await supabase.from('users').select('username').eq('id', id).maybeSingle();
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.username === 'admin') {
        return res.status(400).json({ error: 'Главного администратора нельзя удалить/заблокировать' });
    }

    // Soft delete (is_active = false)
    const { error } = await supabase.from('users').update({ is_active: false }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    // Audit Log
    await supabase.from('audit_logs').insert({
        user_id: req.session.user.id,
        action: 'Заблокирован пользователь',
        target: user.username,
        details: `Мягкое удаление (is_active = false)`
    });

    res.json({ success: true, message: 'Пользователь заблокирован' });
});

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
    let { name, description, can_view_dashboard, can_view_map, can_view_journal, can_move_locomotives, can_edit_catalog, can_manage_users } = req.body;
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
            can_complete_remarks: can_complete_remarks ?? true
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
    let { name, description, can_view_dashboard, can_view_map, can_view_journal, can_move_locomotives, can_edit_catalog, can_manage_users, can_complete_remarks } = req.body;

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
                can_complete_remarks: can_complete_remarks ?? true
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
        can_complete_remarks: can_complete_remarks ?? true
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
        .select('id, number, status, track, position, created_at, repair_type, planned_release');

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
    const { number, status, track, position, repair_type, planned_release } = req.body;

    if (!number) {
        return res.status(400).json({ error: 'Номер локомотива обязателен' });
    }

    // Check if number already exists
    const { data: existing } = await supabase
        .from('locomotives')
        .select('id')
        .eq('number', number)
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
    const { is_completed } = req.body;

    const updates = {
        is_completed: is_completed,
        completed_by: is_completed ? req.session.user.id : null,
        completed_at: is_completed ? new Date().toISOString() : null
    };

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

    // Log to movements and history
    try {
        const remark = data[0];

        // Ensure we log to the new history table
        await supabase.from('remark_history').insert({
            remark_id: remark.id,
            user_id: req.session.user.id,
            action: is_completed ? 'completed' : 'reopened',
            details: is_completed ? 'Отмечено как выполненное' : 'Отметка о выполнении снята'
        });

        const { data: loco } = await supabase.from('locomotives').select('number').eq('id', remark.locomotive_id).maybeSingle();
        if (loco) {
            await supabase.from('movements').insert({
                locomotive_id: remark.locomotive_id,
                locomotive_number: loco.number,
                action: is_completed ? `remark_completed: ${remark.text}` : `remark_reopened: ${remark.text}`,
                moved_by: req.session.user.full_name || req.session.user.username
            });
        }
    } catch (logErr) {
        console.error("Error logging remark completion:", logErr);
    }

    res.json(data[0]);
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
        let query = supabase
            .from('movements')
            .select('*')
            .order('moved_at', { ascending: false })
            .limit(5000);

        const showAllLocations = req.query.all_locations === 'true' && req.session.user.is_global_admin;
        if (!showAllLocations && req.session.user.active_location_id) {
            query = query.eq('location_id', req.session.user.active_location_id);
        }

        const { data: movements, error } = await query;

        if (error) return res.status(500).json({ error: error.message });

        // Build CSV
        const actionLabels = {
            'add': 'Добавлен',
            'move': 'Перемещён',
            'remove': 'Удалён',
        };

        const header = '№;Дата;Локомотив;Действие;Откуда;Куда;Пользователь\n';
        const rows = (movements || []).map((m, i) => {
            const action = m.action.startsWith('remove_from_track')
                ? 'Убран с пути: ' + (m.action.includes(': ') ? m.action.split(': ').slice(1).join(': ') : '')
                : (actionLabels[m.action] || m.action);
            const from = m.from_track ? `Путь ${m.from_track}, Слот ${m.from_position}` : '—';
            const to = m.to_track ? `Путь ${m.to_track}, Слот ${m.to_position}` : '—';
            const date = new Date(m.moved_at).toLocaleString('ru-RU');
            return `${i + 1};${date};${m.locomotive_number};${action};${from};${to};${m.moved_by} `;
        }).join('\n');

        const bom = '\ufeff'; // for Excel UTF-8 support
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=journal_export.csv');
        res.send(bom + header + rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===================== USER PROFILE =====================

app.put('/api/profile/password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Укажите текущий и новый пароль' });
    }
    if (newPassword.length < 4) {
        return res.status(400).json({ error: 'Новый пароль должен быть минимум 4 символа' });
    }

    const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', req.session.user.id)
        .maybeSingle();

    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
        return res.status(400).json({ error: 'Неверный текущий пароль' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase
        .from('users')
        .update({ password: hashedPassword })
        .eq('id', req.session.user.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});


// ===================== KIOSK ROUTES =====================

// Temporary DEBUG route to set admin PIN to 1234
app.get('/api/debug/reset-admin-pin', async (req, res) => {
    try {
        const { data, error } = await supabase.from('users').update({ pin_code: '1234' }).eq('username', 'admin');
        if (error) throw error;
        res.send('Admin PIN reset to 1234');
    } catch (e) { res.status(500).send(e.message); }
});

// Temporary DEBUG route to list users
app.get('/api/debug/users', async (req, res) => {
    try {
        const { data, error } = await supabase.from('users').select('username, pin_code, full_name');
        res.json({ users: data, error });
    } catch (e) { res.status(500).send(e.message); }
});

// Verify PIN-only (for Kiosk)
app.get('/api/kiosk/verify-pin', async (req, res) => {
    const { pin } = req.query;
    console.log(`🔌 Kiosk: Attempting PIN verification for: ${pin}`);
    if (!pin) return res.status(400).json({ error: 'PIN required' });

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, full_name, role, location_id')
            .eq('pin_code', pin)
            .maybeSingle();

        if (error) {
            console.error('❌ Kiosk DB Error:', error);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }

        if (!user) {
            console.log('⚠️ Kiosk: User not found for this PIN');
            return res.status(401).json({ error: 'Неверный PIN' });
        }

        console.log(`✅ Kiosk: Authenticated user: ${user.username} (${user.full_name})`);

        // Log them in for this session
        req.session.user = user;
        res.json(user);
    } catch (err) {
        console.error('❌ Kiosk Server Error:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Start work on a remark
app.post('/api/work-logs/start', requireAuth, async (req, res) => {
    const { remark_id } = req.body;
    const user_id = req.session.user.id;
    const location_id = req.session.user.location_id;

    if (!remark_id) return res.status(400).json({ error: 'remark_id is required' });

    try {
        // Check if there's already an active work log for this user
        const { data: activeLog, error: searchError } = await supabase
            .from('work_logs')
            .select('id')
            .eq('user_id', user_id)
            .is('finished_at', null)
            .maybeSingle();

        if (activeLog) {
            return res.status(400).json({ error: 'У вас уже есть активная работа. Сначала завершите её.' });
        }

        const { data: log, error } = await supabase
            .from('work_logs')
            .insert([{ user_id, remark_id, location_id }])
            .select()
            .single();

        if (error) throw error;

        // Also update the remark history
        await supabase.from('remark_history').insert([{
            remark_id,
            user_id,
            action: 'work_started',
            details: `Сотрудник приступил к выполнению работы через Киоск`
        }]);

        res.json(log);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Stop work on a remark
app.post('/api/work-logs/stop', requireAuth, async (req, res) => {
    const { log_id } = req.body;
    const user_id = req.session.user.id;

    if (!log_id) return res.status(400).json({ error: 'log_id is required' });

    try {
        const finished_at = new Date().toISOString();

        // Find the log and update it
        const { data: log, error } = await supabase
            .from('work_logs')
            .update({ finished_at })
            .eq('id', log_id)
            .eq('user_id', user_id)
            .select()
            .single();

        if (error) throw error;

        // Update remark history
        await supabase.from('remark_history').insert([{
            remark_id: log.remark_id,
            user_id,
            action: 'work_finished',
            details: `Работа завершена через Киоск`
        }]);

        res.json(log);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get active work for the current user
app.get('/api/work-logs/active', requireAuth, async (req, res) => {
    const user_id = req.session.user.id;

    try {
        const { data: log, error } = await supabase
            .from('work_logs')
            .select('*, locomotive_remarks(*, locomotives(number))')
            .eq('user_id', user_id)
            .is('finished_at', null)
            .maybeSingle();

        if (error) throw error;
        res.json(log);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===================== PAGE ROUTES =====================

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

// ===================== STARTUP =====================

// Force admin PIN to 1234 on every startup for Kiosk mode consistency
supabase.from('users').update({ pin_code: '1234' }).eq('username', 'admin').then(() => {
    console.log('🚂 Admin PIN synchronized to 1234');
});

app.listen(PORT, () => {
    console.log(`🚂 Yamazumi Depot Server running at http://localhost:${PORT}`);
    console.log(`📦 Database: Supabase (${process.env.SUPABASE_URL})`);
});
