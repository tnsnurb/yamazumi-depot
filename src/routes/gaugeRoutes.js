const express = require('express');
const router = express.Router();
const gaugeController = require('../controllers/gaugeController');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const upload = require('multer')({ storage: require('multer').memoryStorage() });

// Все маршруты требуют авторизации
router.get('/', requireAuth, gaugeController.getAllGauges);
router.get('/serial/:serial', requireAuth, gaugeController.getGaugeBySerial);
router.get('/locomotive/:locomotiveId', requireAuth, gaugeController.getGaugesByLocomotive);
router.get('/locomotive/:locomotiveId/history', requireAuth, gaugeController.getGaugeHistoryByLocomotive);
router.get('/:id/history', requireAuth, gaugeController.getGaugeHistory);

// Создание, обновление и удаление требуют прав администратора (или специального разрешения)
router.post('/', requireAuth, requireAdmin, gaugeController.createGauge);
router.put('/:id', requireAuth, requireAdmin, gaugeController.updateGauge);
router.delete('/:id', requireAuth, requireAdmin, gaugeController.deleteGauge);
router.post('/:id/photo', requireAuth, upload.single('photo'), gaugeController.uploadPhoto);
router.post('/:id/certificate', requireAuth, upload.single('certificate'), gaugeController.uploadCertificate);

module.exports = router;
