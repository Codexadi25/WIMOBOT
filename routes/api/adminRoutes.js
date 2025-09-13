const express = require('express');
const router = express.Router();
const multer = require('multer');
const { bulkUploadCands, getLogs } = require('../../controllers/adminController');
const { isAdmin } = require('../../middleware/authMiddleware');

// Setup multer for in-memory file storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/bulk-upload-cands', isAdmin, upload.single('jsonFile'), bulkUploadCands);
router.get('/logs', isAdmin, getLogs);

module.exports = router;