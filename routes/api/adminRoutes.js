const express = require('express');
const router = express.Router();
const multer = require('multer');
const { bulkUploadCands, getLogs, getUsers, updateUserRole, deleteUser, cleanupLogs } = require('../../controllers/adminController');
const { isAdmin } = require('../../middleware/authMiddleware');

// Setup multer for in-memory file storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/bulk-upload-cands', isAdmin, upload.single('jsonFile'), bulkUploadCands);
router.get('/logs', isAdmin, getLogs);
router.get('/users', isAdmin, getUsers);
router.put('/users/:id/role', isAdmin, updateUserRole);
router.delete('/users/:id', isAdmin, deleteUser);
router.post('/cleanup-logs', isAdmin, cleanupLogs);

module.exports = router;