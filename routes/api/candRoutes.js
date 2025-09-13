const express = require('express');
const router = express.Router();
const { 
    createCategory, 
    updateCategory, 
    deleteCategory, 
    addTemplate, 
    updateTemplate, 
    deleteTemplate 
} = require('../../controllers/candController');
const { isEditorOrAdmin } = require('../../middleware/authMiddleware');

router.post('/category', isEditorOrAdmin, createCategory);
router.put('/category/:id', isEditorOrAdmin, updateCategory);
router.delete('/category/:id', isEditorOrAdmin, deleteCategory);

router.post('/template/:categoryId', isEditorOrAdmin, addTemplate);
router.put('/template/:categoryId/:templateId', isEditorOrAdmin, updateTemplate);
router.delete('/template/:categoryId/:templateId', isEditorOrAdmin, deleteTemplate);

module.exports = router;