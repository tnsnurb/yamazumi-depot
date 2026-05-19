const express = require('express');
const router = express.Router();
const gaugeTypeController = require('../controllers/gaugeTypeController');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const path = require('path');
const upload = require('multer')({
    storage: require('multer').memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|heic/;
        if (allowed.test(path.extname(file.originalname).toLowerCase())) {
            cb(null, true);
        } else {
            cb(new Error('Недопустимый формат файла'));
        }
    }
});

// Все маршруты справочника требуют авторизации
router.get('/', requireAuth, gaugeTypeController.getAll);

// Создание, обновление и удаление требуют прав администратора
router.post('/', requireAuth, requireAdmin, gaugeTypeController.create);
router.put('/:id', requireAuth, requireAdmin, gaugeTypeController.update);
router.delete('/:id', requireAuth, requireAdmin, gaugeTypeController.delete);
router.post('/:id/photo', requireAuth, upload.single('photo'), gaugeTypeController.uploadPhoto);

module.exports = router;
