const express = require('express');
const router = express.Router();
const gaugeController = require('../controllers/gaugeController');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const path = require('path');
const upload = require('multer')({
    storage: require('multer').memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|heic|pdf/;
        if (allowed.test(path.extname(file.originalname).toLowerCase())) {
            cb(null, true);
        } else {
            cb(new Error('Недопустимый формат файла. Разрешены: изображения и PDF'));
        }
    }
});

// Все маршруты требуют авторизации
router.get('/', requireAuth, gaugeController.getAllGauges);
router.get('/alerts', requireAuth, gaugeController.getAlerts);
router.get('/serial/:serial', requireAuth, gaugeController.getGaugeBySerial);
router.get('/locomotive/:locomotiveId', requireAuth, gaugeController.getGaugesByLocomotive);
router.get('/locomotive/:locomotiveId/history', requireAuth, gaugeController.getGaugeHistoryByLocomotive);
router.get('/:id/history', requireAuth, gaugeController.getGaugeHistory);

// Создание, обновление и удаление требуют прав администратора (или специального разрешения)
router.post('/', requireAuth, requireAdmin, gaugeController.createGauge);
router.post('/import', requireAuth, requireAdmin, upload.single('file'), gaugeController.bulkImport);
router.put('/:id', requireAuth, requireAdmin, gaugeController.updateGauge);
router.delete('/:id', requireAuth, requireAdmin, gaugeController.deleteGauge);
router.post('/:id/photo', requireAuth, upload.single('photo'), gaugeController.uploadPhoto);
router.post('/:id/certificate', requireAuth, upload.single('certificate'), gaugeController.uploadCertificate);

module.exports = router;

