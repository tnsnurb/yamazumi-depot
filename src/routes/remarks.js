const express = require('express');
const remarkController = require('../controllers/remarkController');
const { requireAuth, requirePermission } = require('../middlewares/auth');
const upload = require('multer')({ storage: require('multer').memoryStorage() });

const router = express.Router();

/**
 * Remark Routes
 * (Mounted at /api/remarks)
 */

// General Feed & Stats
router.get('/', requireAuth, remarkController.getFeed);
router.get('/active', requireAuth, remarkController.getActiveStats);

// Bulk operations
router.put('/complete-batch', requireAuth, requirePermission('can_complete_remarks'), remarkController.bulkComplete);

// Single remark operations
router.put('/:id', requireAuth, requirePermission('can_complete_remarks'), remarkController.updateRemark);
router.put('/:id/complete', requireAuth, requirePermission('can_complete_remarks'), remarkController.toggleComplete);
router.put('/:id/verify', requireAuth, requirePermission('can_verify_remarks'), remarkController.verify);
router.put('/:id/reject', requireAuth, requirePermission('can_verify_remarks'), remarkController.reject);
router.put('/:id/assign', requireAuth, requirePermission('can_complete_remarks'), remarkController.assign);

// History, Photos, Comments
router.get('/:id/history', requireAuth, remarkController.getHistory);
router.get('/:id/photos', requireAuth, remarkController.getPhotos);
router.post('/:id/photos', requireAuth, upload.single('photo'), remarkController.addPhoto);
router.get('/:id/comments', requireAuth, remarkController.getComments);
router.post('/:id/comments', requireAuth, remarkController.addComment);

module.exports = router;
