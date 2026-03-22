const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const { requireAuth } = require('../middlewares/auth');

/**
 * Session Routes
 * (Mounted at /api/sessions)
 */
router.get('/active', requireAuth, sessionController.getActiveSessions);
router.get('/history', requireAuth, sessionController.getHistory);

module.exports = router;
