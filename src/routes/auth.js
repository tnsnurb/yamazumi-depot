const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const supabase = require('../../db');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// Multer Setup for Avatar Uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const minetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (minetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Недопустимый формат файла!"));
    }
});

// GET /api/me
router.get('/me', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false, user: null });
    }
});

// POST /api/login/terminal
router.post('/login/terminal', async (req, res) => {
    try {
        const { username, pin_code } = req.body;

        if (!username || !pin_code) {
            return res.status(400).json({ error: 'Пожалуйста, введите логин и PIN-код' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Пользователь не найден' });
        }

        if (!user.pin_code) {
            return res.status(401).json({ error: 'Для этого пользователя не установлен PIN-код. Для первого входа используйте основной интерфейс логина.' });
        }

        const isMatch = await bcrypt.compare(pin_code, user.pin_code);

        if (!isMatch) {
            return res.status(401).json({ error: 'Неверный PIN-код' });
        }

        const { data: roleData } = await supabase
            .from('roles')
            .select('*')
            .eq('name', user.role)
            .maybeSingle();

        user.permissions = roleData || {};
        req.session.user = user;
        req.session.login_type = 'terminal';

        console.log(`[AUTH] User ${user.username} logged in via TERMINAL`);

        res.json({ success: true, user });

    } catch (err) {
        console.error("Terminal login error:", err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// POST /api/login (Supabase Auth handler)
router.post('/login', async (req, res) => {
    const { token, user } = req.body;
    console.log(`[DEBUG] /api/login attempt for user: ${user?.email || user?.id}`);

    if (!token || !user) {
        console.warn("[DEBUG] Missing token or user in request body");
        return res.status(400).json({ error: 'Отсутствуют данные пользователя или токен' });
    }

    try {
        const { data: dbUser, error } = await supabase
            .from('users')
            .select('*')
            .eq('uuid', user.id)
            .single();

        if (error || !dbUser) {
            console.warn(`[DEBUG] User missing in public.users: ${user.id}`, error?.message);
            // Fallback for missing records
            req.session.user = {
                id: null,
                username: user.email ? user.email.split('@')[0] : 'user',
                role: 'worker',
                uuid: user.id
            };
        } else {
            const { data: roleData } = await supabase
                .from('roles')
                .select('*')
                .eq('name', dbUser.role)
                .maybeSingle();

            // Preserve active_location_id if session already exists for this user
            if (req.session.user && req.session.user.id === dbUser.id) {
                dbUser.active_location_id = req.session.user.active_location_id;
            } else {
                dbUser.active_location_id = dbUser.location_id;
            }
            dbUser.permissions = roleData || {};
            req.session.user = dbUser;
        }

        req.session.access_token = token;
        req.session.login_type = 'web';

        console.log(`[AUTH] User ${req.session.user.username} logged in via SUPABASE_AUTH`);

        res.json({ success: true, user: req.session.user });

    } catch (error) {
        console.error('[DEBUG] /api/login exception:', error);
        res.status(500).json({ error: 'Ошибка сервера при авторизации' });
    }
});

// POST /api/logout
router.post('/logout', (req, res) => {
    const user = req.session.user ? req.session.user.username : 'Unknown';
    req.session.destroy(err => {
        if (err) {
            console.error("Session destroy error:", err);
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.clearCookie('connect.sid');
        console.log(`[AUTH] User ${user} logged out`);
        return res.status(200).json({ message: 'Logged out successfully' });
    });
});

// Switch active location (for Global Admins)
router.put('/me/active-location', requireAuth, (req, res) => {
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

// POST /api/profile/avatar
router.post('/profile/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }

    try {
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `${req.session.user.id}_${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(filePath, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true
            });

        if (error) {
            console.error("Supabase Storage Error:", error);
            return res.status(500).json({ error: 'Ошибка загрузки файла в хранилище' });
        }

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        const { error: updateError } = await supabase
            .from('users')
            .update({ avatar_url: publicUrl })
            .eq('id', req.session.user.id);

        if (updateError) {
            console.error("Supabase Update Error:", updateError);
            return res.status(500).json({ error: 'Ошибка обновления профиля' });
        }

        req.session.user.avatar_url = publicUrl;

        res.json({ success: true, avatar_url: publicUrl });

    } catch (err) {
        console.error("Avatar upload exception:", err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Update own profile (PIN code, password)
router.put('/profile', requireAuth, async (req, res) => {
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

// GET /api/public/users (Used by Login page)
router.get('/public/users', async (req, res) => {
    try {
        let query = supabase
            .from('users')
            .select(`
                id,
                username,
                full_name,
                role,
                avatar_url,
                email
            `)
            .order('full_name', { ascending: true });

        // If session exists and has location (e.g. kiosk mode setup), filter by it
        if (req.session && req.session.user && !req.session.user.is_global_admin && req.session.user.active_location_id) {
            query = query.eq('location_id', req.session.user.active_location_id);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error("Error fetching public users:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/login/barcode
router.post('/login/barcode', async (req, res) => {
    const { barcode } = req.body;
    if (!barcode) return res.status(400).json({ error: 'Штрих-код обязателен' });

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, full_name, role, avatar_url')
            .eq('barcode', barcode)
            .maybeSingle();

        if (error) throw error;

        if (user) {
            res.json({ found: true, user });
        } else {
            res.json({ found: false, error: 'Пользователь не найден' });
        }
    } catch (err) {
        console.error("Barcode search error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
