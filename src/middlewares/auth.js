const supabase = require('../../db');

// 1. Основной барьер (Аутентификация)
async function requireAuth(req, res, next) {
    // Приоритет: Быстрая проверка сессии
    if (req.session && req.session.user) {
        req.user = req.session.user;
        return next();
    }

    // Фолбэк: Проверка JWT токена
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];

        try {
            const { data: { user: authUser }, error } = await supabase.auth.getUser(token);

            if (error) {
                console.error("❌ JWT Verification Error:", error.message);
            } else if (authUser) {
                const { data: user, error: userError } = await supabase
                    .from('users')
                    .select('id, uuid, username, full_name, role, avatar_url, location_id, is_global_admin, specialization, total_points')
                    .eq('uuid', authUser.id)
                    .maybeSingle();

                if (userError) {
                    console.error("❌ Profile Fetch Error:", userError.message);
                } else if (user) {
                    const { data: roleData } = await supabase
                        .from('roles')
                        .select('*')
                        .eq('name', user.role)
                        .maybeSingle();

                    req.user = {
                        ...user,
                        active_location_id: user.location_id,
                        permissions: roleData || {}
                    };

                    // Кэшируем профиль в сессии
                    if (req.session) {
                        req.session.user = req.user;
                        req.session.access_token = token;
                    }

                    console.log(`✅ Auth success for user: ${user.username}`);
                    return next();
                }
            }
        } catch (err) {
            console.error("❌ General JWT Auth error:", err);
        }
    }

    console.error(`❌ DENIED: 401 Unauthorized for ${req.url}`);
    return res.status(401).json({ error: 'Unauthorized: Please log in via Supabase' });
}

// 2. Авторизация: Проверка на Администратора
function requireAdmin(req, res, next) {
    const user = req.user;
    
    // Предохранитель на случай пропущенного requireAuth в роуте
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Проверка строковой роли + системного флага
    if (user.role === 'admin' || user.role === 'global_admin' || user.is_global_admin) {
        return next();
    }
    
    return res.status(403).json({ error: 'Forbidden: Admins only' });
}

// 3. Авторизация: Проверка конкретных прав доступа
function requirePermission(permissionStr) {
    return (req, res, next) => {
        const user = req.user;
        
        // Предохранитель
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // Админы пропускаются везде автоматически
        if (user.role === 'admin' || user.role === 'global_admin' || user.is_global_admin) {
            return next();
        }
        
        // Точечная проверка прав по ключу из таблицы roles
        if (user.permissions && user.permissions[permissionStr]) {
            return next();
        }
        
        return res.status(403).json({ error: 'Доступ запрещен' });
    };
}

module.exports = {
    requireAuth,
    requireAdmin,
    requirePermission
};
