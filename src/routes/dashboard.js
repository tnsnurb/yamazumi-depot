const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middlewares/auth');

/**
 * Dashboard Routes
 */

router.get('/', requireAuth, dashboardController.getStats);
router.get('/chart', requireAuth, dashboardController.getChartData);

module.exports = router;
