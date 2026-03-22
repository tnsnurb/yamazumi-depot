const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

/**
 * Admin Routes
 * (Mounted at /api)
 */
router.get('/audit-logs', requireAuth, requireAdmin, adminController.getAuditLogs);

module.exports = router;
