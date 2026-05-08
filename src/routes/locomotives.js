const express = require('express');
const router = express.Router();
const locomotiveController = require('../controllers/locomotiveController');
const remarkController = require('../controllers/remarkController');
const { requireAuth, requirePermission } = require('../middlewares/auth');

/**
 * Locomotive Routes
 */

// GET /api/locomotives - List (Optional location filter)
router.get('/', requireAuth, locomotiveController.getAll);

// GET /api/locomotives/:id - Details
router.get('/:id', requireAuth, locomotiveController.getById);

// POST /api/locomotives - Add new or reactivate
router.post('/', requireAuth, requirePermission('can_edit_catalog'), locomotiveController.create);

// Update/Delete (Permission: can_edit_catalog)
router.put('/:id', requireAuth, requirePermission('can_edit_catalog'), locomotiveController.update);
router.delete('/:id', requireAuth, requirePermission('can_edit_catalog'), locomotiveController.delete);

// Movement (Permission: can_move_locomotives)
router.put('/:id/move', requireAuth, requirePermission('can_move_locomotives'), locomotiveController.move);

// Wheelset measurements
router.get('/:id/wheelset', requireAuth, locomotiveController.getWheelset);
router.post('/:id/wheelset', requireAuth, locomotiveController.saveWheelset);
router.get('/:id/wheelset/export', requireAuth, locomotiveController.exportWheelset);

// Remarks for specific locomotive
router.get('/:id/remarks', requireAuth, remarkController.getLocomotiveRemarks);
router.post('/:id/remarks', requireAuth, requirePermission('can_edit_catalog'), remarkController.createRemark);
router.post('/:id/remarks/template', requireAuth, requirePermission('can_edit_catalog'), remarkController.createFromTemplate);
router.post('/:id/remarks/bulk', requireAuth, requirePermission('can_edit_catalog'), remarkController.bulkCreate);
router.post('/:id/remarks/from-catalog', requireAuth, requirePermission('can_edit_catalog'), remarkController.createFromCatalog);

router.get('/:id/sessions', requireAuth, locomotiveController.getSessions);

module.exports = router;
