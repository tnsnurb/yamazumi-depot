const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const profileController = require('../controllers/profileController');

const router = express.Router();

router.put('/password', requireAuth, profileController.updatePassword);

module.exports = router;
