const express = require('express');
const cookieSession = require('cookie-session');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

/**
 * Express middleware configuration
 * @param {import('express').Application} app 
 */
module.exports = function(app) {
    // 0. Validate critical secrets in production
    if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
        console.error('FATAL: SESSION_SECRET must be set in production!');
        process.exit(1);
    }
    // 1. Security Headers (Усилено)
    // Включаем базовые защиты, но оставляем CSP достаточно гибким, 
    // чтобы не сломать клиентское приложение (например, запросы к Supabase)
    app.use(helmet({
        crossOriginEmbedderPolicy: false, // Часто ломает загрузку картинок с других доменов
        contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false // Включаем строгий CSP только в проде
    }));

    // 2. CORS configuration (Белый список)
    const allowedOrigins = process.env.NODE_ENV === 'production' 
        ? [
            process.env.FRONTEND_URL, 
            'https://yamazumi.tech', 
            'https://www.yamazumi.tech'
          ].filter(Boolean)
        : ['http://localhost:5173', 'http://localhost:3000']; // Разрешаем локальную разработку

    app.use(cors({
        origin: function (origin, callback) {
            // Разрешаем запросы без origin (например, POSTman или серверные скрипты)
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                // Возвращаем false вместо new Error, чтобы не вызывать 500 ошибку сервера
                callback(null, false);
            }
        },
        credentials: true // Важно для работы cookie-session
    }));

    // 3. Performance & Body Parsing (Защита от DoS)
    app.use(compression());
    // Снижаем глобальный лимит. 2mb хватит для 99% текстовых JSON запросов.
    // Если где-то нужна загрузка больших файлов, лимит нужно будет увеличить точечно в самом роутере.
    app.use(express.json({ limit: '2mb' }));
    app.use(express.urlencoded({ limit: '2mb', extended: true }));

    // 4. Persistent Sessions (Stored in encrypted browser cookies)
    // No database password required. Sessions survive server restarts.
    app.use(cookieSession({
        name: 'session',
        keys: [process.env.SESSION_SECRET || 'yamazumi-depot-session-secret-key'],
        
        // Cookie Options
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true, // Prevents client-side JS from reading the cookie
        secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
        sameSite: 'lax'
    }));

    // 5. Logging (Optional, but useful)
    app.use((req, res, next) => {
        if (process.env.NODE_ENV !== 'test') {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        }
        next();
    });

    // 6. Static files
    // Assuming this file is in src/config/, we go up two levels to reach the root
    app.use(express.static(path.join(__dirname, '../../frontend/dist')));

    // 7. Global Error Handler (prevents stack trace leaks)
    app.use((err, req, res, next) => {
        console.error(`[ERROR] ${req.method} ${req.url}:`, err.message);
        if (process.env.NODE_ENV === 'production') {
            res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        } else {
            res.status(500).json({ error: err.message, stack: err.stack });
        }
    });
};
