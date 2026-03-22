const express = require('express');
const router = express.Router();
const gaugeTypeController = require('../controllers/gaugeTypeController');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const upload = require('multer')({ storage: require('multer').memoryStorage() });

// Все маршруты справочника требуют авторизации
router.get('/', requireAuth, gaugeTypeController.getAll);

// Создание, обновление и удаление требуют прав администратора
router.post('/', requireAuth, requireAdmin, gaugeTypeController.create);
router.put('/:id', requireAuth, requireAdmin, gaugeTypeController.update);
router.delete('/:id', requireAuth, requireAdmin, gaugeTypeController.delete);
router.post('/:id/photo', requireAuth, upload.single('photo'), gaugeTypeController.uploadPhoto);

module.exports = router;
