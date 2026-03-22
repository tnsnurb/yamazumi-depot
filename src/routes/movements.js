const express = require('express');
const router = express.Router();
const movementController = require('../controllers/movementController');
const { requireAuth } = require('../middlewares/auth');

/**
 * Movement Routes
 */

router.get('/', requireAuth, movementController.getAll);
router.get('/export', requireAuth, movementController.export);
router.get('/stats', requireAuth, movementController.getStats);
router.get('/users', requireAuth, movementController.getUsers);
router.get('/locomotives', requireAuth, movementController.getLocomotives);
router.get('/by-locomotive/:number', requireAuth, movementController.getByLocomotive);

module.exports = router;
