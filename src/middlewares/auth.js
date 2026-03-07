const supabase = require('../../db');

async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];

        // OPTIMIZATION: Check session first to avoid redundant Supabase/DB calls
        if (req.session.user && req.session.access_token === token) {
            req.user = req.session.user;
            return next();
        }

        try {
            // This is the slow part (network call to Supabase)
            const { data: { user: authUser }, error } = await supabase.auth.getUser(token);

            if (error) {
                console.error("❌ JWT Verification Error:", error.message);
                // Clear session if token is invalid
                req.session.user = null;
                req.session.access_token = null;
            } else if (authUser) {
                // Fetch full user profile from public.users
                const { data: user, error: userError } = await supabase
                    .from('users')
                    .select('id, username, full_name, role, avatar_url, pin_code, location_id, is_global_admin, specialization, total_points')
                    .eq('uuid', authUser.id)
                    .maybeSingle();

                if (userError) {
                    console.error("❌ Profile Fetch Error:", userError.message);
                } else if (user) {
                    // Fetch role permissions
                    const { data: roleData } = await supabase
                        .from('roles')
                        .select('*')
                        .eq('name', user.role)
                        .maybeSingle();

                    // Determine active location: prefer session override if it exists and belongs to the same user
                    const activeLocationId = (req.session.user && req.session.user.id === user.id)
                        ? req.session.user.active_location_id
                        : user.location_id;

                    req.user = {
                        ...user,
                        active_location_id: activeLocationId,
                        permissions: roleData || {}
                    };

                    // Cache in session
                    req.session.user = req.user;
                    req.session.access_token = token;

                    console.log(`✅ Auth success for user: ${user.username} (Cached in session)`);
                    return next();
                } else {
                    console.error(`❌ User profile not found for UUID: ${authUser.id}`);
                }
            }
        } catch (err) {
            console.error("❌ General JWT Auth error:", err);
        }
    } else {
        console.warn(`⚠️ No Authorization header for request: ${req.url}`);
    }

    console.error(`❌ DENIED: 401 Unauthorized for ${req.url}`);
    return res.status(401).json({ error: 'Unauthorized: Please log in via Supabase' });
}

async function requireAdmin(req, res, next) {
    await requireAuth(req, res, async () => {
        const user = req.user || req.session.user;
        if (user && (user.role === 'admin' || user.role === 'global_admin')) {
            return next();
        }
        return res.status(403).json({ error: 'Forbidden: Admins only' });
    });
}

function requirePermission(permissionStr) {
    return async (req, res, next) => {
        await requireAuth(req, res, async () => {
            const user = req.user || req.session.user;
            if (!user) return res.status(401).json({ error: 'Unauthorized' });
            if (user.role === 'admin') return next();
            if (user.permissions && user.permissions[permissionStr]) {
                return next();
            }
            return res.status(403).json({ error: 'Доступ запрещен' });
        });
    };
}

module.exports = {
    requireAuth,
    requireAdmin,
    requirePermission
};
