const express = require('express');
const rateLimit = require('express-rate-limit');
const remarkController = require('../controllers/remarkController');
const { requireAuth, requirePermission } = require('../middlewares/auth');
const path = require('path');
const upload = require('multer')({
    storage: require('multer').memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|heic/;
        if (allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase())) {
            cb(null, true);
        } else {
            cb(new Error('Недопустимый формат файла. Разрешены: JPEG, PNG, GIF, WebP'));
        }
    }
});

// Rate limiters for mutating operations
const mutationLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 mutations per minute per IP
    message: { error: 'Слишком много запросов. Повторите позже.' }
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10, // 10 uploads per minute
    message: { error: 'Слишком много загрузок. Повторите позже.' }
});

const router = express.Router();

/**
 * Remark Routes
 * (Mounted at /api/remarks)
 */

// General Feed & Stats
router.get('/', requireAuth, remarkController.getFeed);
router.get('/active', requireAuth, remarkController.getActiveStats);

// Bulk operations
router.put('/complete-batch', requireAuth, mutationLimiter, requirePermission('can_complete_remarks'), remarkController.bulkComplete);

// Single remark operations
router.put('/:id', requireAuth, mutationLimiter, requirePermission('can_complete_remarks'), remarkController.updateRemark);
router.put('/:id/complete', requireAuth, mutationLimiter, requirePermission('can_complete_remarks'), remarkController.toggleComplete);
router.put('/:id/verify', requireAuth, mutationLimiter, requirePermission('can_verify_remarks'), remarkController.verify);
router.put('/:id/reject', requireAuth, mutationLimiter, requirePermission('can_verify_remarks'), remarkController.reject);
router.put('/:id/assign', requireAuth, mutationLimiter, requirePermission('can_complete_remarks'), remarkController.assign);

// History, Photos, Comments
router.get('/:id/history', requireAuth, remarkController.getHistory);
router.get('/:id/photos', requireAuth, remarkController.getPhotos);
router.post('/:id/photos', requireAuth, uploadLimiter, upload.single('photo'), remarkController.addPhoto);
router.get('/:id/comments', requireAuth, remarkController.getComments);
router.post('/:id/comments', requireAuth, mutationLimiter, remarkController.addComment);

module.exports = router;
