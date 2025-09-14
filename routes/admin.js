const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();
const adminController = require('../controllers/adminController');
const isAdmin = require('../middleware/isAdmin');

// mount this router under /api/admin in app.js

// Cands bulk upload (multipart JSON file)
router.post('/bulk-upload-cands', isAdmin, upload.single('jsonFile'), adminController.bulkUploadCands);

// Logs
router.get('/logs', isAdmin, adminController.getLogs);
router.post('/cleanup-logs', isAdmin, adminController.cleanupLogs);

// Users management (admin-only)
router.get('/users', isAdmin, adminController.getUsers);
router.put('/users/:id/role', isAdmin, adminController.updateUserRole);
router.put('/users/:id/password', isAdmin, adminController.updateUserPassword);
router.post('/users/:id/reset-password', isAdmin, adminController.resetUserPassword);
router.delete('/users/:id', isAdmin, adminController.deleteUser);

// Bulk create users (admin)
router.post('/users/bulk', isAdmin, adminController.bulkCreateUsers);

module.exports = router;