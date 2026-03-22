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
    // 1. Security Headers
    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    }));

    // 2. CORS configuration
    app.use(cors());

    // 3. Performance & Body Parsing
    app.use(compression());
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
};
