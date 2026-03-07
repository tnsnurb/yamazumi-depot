const express = require('express');
const supabase = require('../../db');
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// Public endpoint to get list of users for terminal mode login
router.get('/public', async (req, res) => {
    let query = supabase
        .from('users')
        .select(`
            id,
            username,
            full_name,
            role,
            avatar_url
        `)
        .order('full_name', { ascending: true });

    if (req.session && req.session.user && !req.session.user.is_global_admin && req.session.user.active_location_id) {
        query = query.eq('location_id', req.session.user.active_location_id);
    }
    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// GET /api/users
router.get('/', requireAdmin, async (req, res) => {
    let query = supabase
        .from('users')
        .select('id, username, full_name, role, created_at, barcode, is_active, specialization, total_points')
        .order('id');

    if (req.session.user.active_location_id) {
        query = query.eq('location_id', req.session.user.active_location_id);
    }
    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// POST /api/users (Create a new user) - Admins only
router.post('/', requireAdmin, async (req, res) => {
    const { username, password, email: providedEmail, full_name, role, barcode, location_id, specialization } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });

    // Check if user exists in public.users
    const { data: existing } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
    if (existing) return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });

    try {
        // 1. Create entry in public.users first (necessary for Method B trigger to pass)
        const email = (providedEmail && providedEmail.includes('@'))
            ? providedEmail
            : `${username}@yamazumi.id`;

        // Check if email already exists
        const { data: emailExisting } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
        if (emailExisting) {
            return res.status(400).json({ error: `Email ${email} уже зарегистрирован в системе` });
        }

        const { data: newUser, error: dbError } = await supabase
            .from('users')
            .insert({
                username,
                email,
                full_name: full_name || username,
                role: role || 'employee',
                barcode: barcode || null,
                specialization: specialization || null,
                location_id: req.session.user.is_global_admin ? (location_id || 1) : req.session.user.location_id,
                is_active: true,
                password: bcrypt.hashSync(password, 10) // Legacy sync
            })
            .select()
            .maybeSingle();

        if (dbError) {
            console.error("❌ Error pre-creating public user:", dbError);
            return res.status(500).json({ error: dbError.message });
        }

        // 2. Create user in Supabase Auth
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                username,
                full_name: full_name || username
            }
        });

        if (authError) {
            console.error("❌ Supabase Auth error:", authError);
            // Cleanup: remove the public user we just created to be consistent
            await supabase.from('users').delete().eq('id', newUser.id);
            return res.status(400).json({ error: `Ошибка Supabase Auth: ${authError.message}` });
        }

        // Audit Log
        await supabase.from('audit_logs').insert({
            user_id: req.session.user.id,
            action: 'Создан пользователь (Method B)',
            target: username,
            details: `Роль: ${role}, Email: ${email}`
        });

        // 3. Update UUID in public.users to link effectively
        await supabase
            .from('users')
            .update({ uuid: authUser.user.id })
            .eq('id', newUser.id);

        res.json({ ...newUser, uuid: authUser.user.id });
    } catch (err) {
        console.error("❌ Critical error in user creation:", err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/users/:id (Admin updating user)
router.put('/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const { username, full_name, role, password, barcode, is_active, location_id, specialization, total_points } = req.body;

    // Get current user to check for admin protection and get UUID
    const { data: user } = await supabase.from('users').select('username, uuid').eq('id', id).maybeSingle();
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    if (user.username === 'admin' && role && role !== 'admin') {
        return res.status(400).json({ error: 'Нельзя изменить роль главному администратору' });
    }
    if (user.username === 'admin' && is_active === false) {
        return res.status(400).json({ error: 'Нельзя заблокировать главного администратора' });
    }

    try {
        const updates = {};
        if (username !== undefined) updates.username = username;
        if (full_name !== undefined) updates.full_name = full_name;
        if (role !== undefined) updates.role = role;
        if (barcode !== undefined) updates.barcode = barcode || null;
        if (is_active !== undefined) updates.is_active = is_active;
        if (req.body.email !== undefined) {
            const newEmail = req.body.email;
            // Check if email already exists for DIFFERENT user
            if (newEmail) {
                const { data: emailConflict } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', newEmail)
                    .neq('id', id)
                    .maybeSingle();
                if (emailConflict) {
                    return res.status(400).json({ error: `Email ${newEmail} уже зарегистрирован за другим пользователем` });
                }
            }
            updates.email = newEmail;
        }
        if (location_id !== undefined && req.session.user.is_global_admin) {
            updates.location_id = location_id;
        }
        if (specialization !== undefined) updates.specialization = specialization;
        if (total_points !== undefined) updates.total_points = total_points;

        // If password is provided, update it in Supabase Auth
        if (password && user.uuid) {
            const { error: authError } = await supabase.auth.admin.updateUserById(
                user.uuid,
                { password }
            );
            if (authError) {
                console.error("❌ Auth update error:", authError);
                return res.status(400).json({ error: `Ошибка при обновлении пароля в Auth: ${authError.message}` });
            }
        }

        // Update record in public.users
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select('id, username, full_name, role, created_at, barcode, is_active, location_id')
            .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });

        // Audit Log
        const changedFields = Object.keys(updates).join(', ');
        await supabase.from('audit_logs').insert({
            user_id: req.session.user.id,
            action: 'Изменен пользователь (Supabase Auth)',
            target: data.username,
            details: `Поля: ${changedFields} ${password ? '+ Пароль' : ''}`
        });

        res.json(data);
    } catch (err) {
        console.error("❌ Critical error in user update:", err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/users/:id
router.delete('/:id', requireAdmin, async (req, res) => {
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

module.exports = router;
