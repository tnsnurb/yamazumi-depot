const path = require('path');

// Conditional TLS bypass for local development ONLY
if (process.env.NODE_ENV === 'development') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    console.warn('WARNING: SSL validation is DISABLED in development mode.');
}

const app = require('express')();
const PORT = 3000;

// Apply centralized configuration (Helmet, CORS, Sessions, Body Parsing, Static Files, etc.)
require('./src/config/express')(app);

// Extracted Routers
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const remarksRoutes = require('./src/routes/remarks');
const locationsRoutes = require('./src/routes/locations');
const checklistRoutes = require('./src/routes/checklists');
const locomotiveRoutes = require('./src/routes/locomotives');
const movementRoutes = require('./src/routes/movements');
const dashboardRoutes = require('./src/routes/dashboard');
const profileRoutes = require('./src/routes/profile');
const dictionaryRoutes = require('./src/routes/dictionaries');
const sessionRoutes = require('./src/routes/sessions');
const adminRoutes = require('./src/routes/admin');
const gaugeRoutes = require('./src/routes/gaugeRoutes');
const gaugeTypeRoutes = require('./src/routes/gaugeTypeRoutes');

// API Routes
app.use('/api', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/remarks', remarksRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/locomotives', locomotiveRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api', dictionaryRoutes);
app.use('/api', adminRoutes);
app.use('/api/gauges', gaugeRoutes);
app.use('/api/gauge-types', gaugeTypeRoutes);

// ===================== PAGE ROUTES =====================

app.get('*', (req, res) => {
    // If it's an API request that wasn't caught by the routers above, return 404 instead of index.html
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚂 Yamazumi Depot Server running at http://localhost:${PORT}`);
    console.log(`📦 Database: Supabase (${process.env.SUPABASE_URL})`);
});
