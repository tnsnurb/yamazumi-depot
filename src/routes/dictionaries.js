const express = require('express');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const dictionaryController = require('../controllers/dictionaryController');

const router = express.Router();

// Catalog Routes
router.get('/catalog', requireAuth, dictionaryController.getCatalog);
router.post('/catalog/manual', requireAuth, requireAdmin, dictionaryController.createCatalogManual);
router.put('/catalog/:id', requireAuth, requireAdmin, dictionaryController.updateCatalog);
router.delete('/catalog/:id', requireAuth, requireAdmin, dictionaryController.deleteCatalog);
router.post('/catalog/bulk', requireAuth, requireAdmin, dictionaryController.bulkCreateCatalog);

// Remark Template Routes
router.get('/remark-templates', requireAuth, dictionaryController.getRemarkTemplates);
router.post('/remark-templates', requireAuth, requireAdmin, dictionaryController.createRemarkTemplate);
router.post('/remark-templates/bulk', requireAuth, requireAdmin, dictionaryController.bulkCreateRemarkTemplates);
router.put('/remark-templates/:id', requireAuth, requireAdmin, dictionaryController.updateRemarkTemplate);
router.delete('/remark-templates/:id', requireAuth, requireAdmin, dictionaryController.deleteRemarkTemplate);

// Repair Type Routes
router.get('/repair-types', requireAuth, dictionaryController.getRepairTypes);
router.post('/repair-types', requireAuth, requireAdmin, dictionaryController.createRepairType);
router.delete('/repair-types/:id', requireAuth, requireAdmin, dictionaryController.deleteRepairType);

// Role Routes
router.get('/roles', requireAuth, dictionaryController.getRoles);
router.post('/roles', requireAuth, requireAdmin, dictionaryController.createRole);
router.put('/roles/:id', requireAuth, requireAdmin, dictionaryController.updateRole);
router.delete('/roles/:id', requireAuth, requireAdmin, dictionaryController.deleteRole);

module.exports = router;
