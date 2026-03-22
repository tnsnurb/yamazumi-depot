const supabase = require('../../db');
const bcrypt = require('bcryptjs');

/**
 * Profile Controller - Handles user-specific profile operations
 */
const profileController = {
    /**
     * Update user password
     */
    updatePassword: async (req, res) => {
        const { currentPassword, newPassword } = req.body;

        // In many recovery scenarios (Magic Link, Reset Password link), 
        // the user might not have/know their "current" password.
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
                    return res.status(400).json({ error: `Ошибка Supabase Auth: ${authError.message}` });
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
    }
};

module.exports = profileController;
