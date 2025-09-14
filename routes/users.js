// lightweight route so client calls to /api/users/bulk remain supported
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const isAdmin = require('../middleware/isAdmin');

// mount this router under /api in app.js to keep legacy client endpoints working:
// app.use('/api', require('./routes/users'));
router.post('/users/bulk', isAdmin, adminController.bulkCreateUsers);

module.exports = router;