require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const supabase = require('./db');

const app = express();
const PORT = 3000;

// Middleware
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

// ===================== AUTH ROUTES =====================

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('id, username, password, full_name, role')
        .eq('username', username)
        .single();

    if (error || !user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    req.session.user = {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
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

// ===================== USER MANAGEMENT ROUTES (ADMIN) =====================

app.get('/api/users', requireAdmin, async (req, res) => {
    const { data, error } = await supabase
        .from('users')
        .select('id, username, full_name, role, created_at')
        .order('id');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/users', requireAdmin, async (req, res) => {
    const { username, password, full_name, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });

    // Check if user exists
    const { data: existing } = await supabase.from('users').select('id').eq('username', username).single();
    if (existing) return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    const { data, error } = await supabase
        .from('users')
        .insert({
            username,
            password: hashedPassword,
            full_name: full_name || null,
            role: role || 'employee'
        })
        .select('id, username, full_name, role, created_at')
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/users/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const { full_name, role, password } = req.body;

    // Protect modifying the main admin
    const { data: user } = await supabase.from('users').select('username').eq('id', id).single();
    if (user && user.username === 'admin' && role && role !== 'admin') {
        return res.status(400).json({ error: 'Нельзя изменить роль главному администратору' });
    }

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (role !== undefined) updates.role = role;
    if (password) updates.password = bcrypt.hashSync(password, 10);

    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select('id, username, full_name, role, created_at')
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);

    // Protect deleting the main admin
    const { data: user } = await supabase.from('users').select('username').eq('id', id).single();
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.username === 'admin') {
        return res.status(400).json({ error: 'Главного администратора нельзя удалить' });
    }

    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
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
    res.json({ success: true, count: data ? data.length : 0, data });
});

// ===================== LOCOMOTIVE ROUTES =====================

app.get('/api/locomotives', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('locomotives')
        .select('*')
        .order('track')
        .order('position');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/locomotives', requireAuth, async (req, res) => {
    const { number, status, track, position } = req.body;

    if (!number) {
        return res.status(400).json({ error: 'Номер локомотива обязателен' });
    }

    // Check if number already exists
    const { data: existing } = await supabase
        .from('locomotives')
        .select('id')
        .eq('number', number)
        .single();

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
            .single();

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
                position: position || null
            })
            .select()
            .single();

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
                moved_by: req.session.user.username
            });
        }

        res.json(loco);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/locomotives/:id', requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);

    const { data: loco } = await supabase
        .from('locomotives')
        .select('*')
        .eq('id', id)
        .single();

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
        moved_by: req.session.user.username
    });

    const { error } = await supabase
        .from('locomotives')
        .delete()
        .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.put('/api/locomotives/:id/move', requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const { track, position } = req.body;

    const { data: loco } = await supabase
        .from('locomotives')
        .select('*')
        .eq('id', id)
        .single();

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
            .neq('id', id)
            .single();

        if (occupied) {
            return res.status(400).json({ error: 'Эта позиция уже занята' });
        }
    }

    // Log movement
    await supabase.from('movements').insert({
        locomotive_id: loco.id,
        locomotive_number: loco.number,
        from_track: loco.track,
        from_position: loco.position,
        to_track: track,
        to_position: position,
        action: 'move',
        moved_by: req.session.user.username
    });

    // Update position
    const { data: updated, error } = await supabase
        .from('locomotives')
        .update({ track, position })
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(updated);
});

app.put('/api/locomotives/:id', requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const { status, number } = req.body;

    const updates = {};
    if (number !== undefined) updates.number = number;
    if (status !== undefined) updates.status = status;

    const { data: updated, error } = await supabase
        .from('locomotives')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!updated) return res.status(404).json({ error: 'Локомотив не найден' });
    res.json(updated);
});

// ===================== MOVEMENT JOURNAL =====================

app.get('/api/movements', requireAuth, async (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const { data: movements, error } = await supabase
        .from('movements')
        .select('*')
        .order('moved_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: error.message });

    const { count } = await supabase
        .from('movements')
        .select('*', { count: 'exact', head: true });

    res.json({ movements: movements || [], total: count || 0 });
});

// ===================== PAGE ROUTES =====================

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

// ===================== STARTUP =====================

app.listen(PORT, () => {
    console.log(`🚂 Yamazumi Depot Server running at http://localhost:${PORT}`);
    console.log(`📦 Database: Supabase (${process.env.SUPABASE_URL})`);
});
