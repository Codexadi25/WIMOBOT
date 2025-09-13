const Category = require('../models/Category');
const Log = require('../models/Log');
const { broadcastUpdate } = require('../utils/webSocketServer');
const asyncHandler = require('express-async-handler');

// @desc    Bulk upload Cands from JSON file, reseting existing data
// @route   POST /api/admin/bulk-upload-cands
// @access  Admin
exports.bulkUploadCands = asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('No JSON file uploaded.');
    }
    
    const jsonData = JSON.parse(req.file.buffer.toString());
    
    if (!jsonData.categories || !Array.isArray(jsonData.categories)) {
        res.status(400);
        throw new Error('Invalid JSON format. File must contain a root "categories" array.');
    }

    // Reset database by deleting all existing categories
    await Category.deleteMany({});
    
    // Insert new data
    await Category.insertMany(jsonData.categories);

    broadcastUpdate({ message: 'Canded responses have been reset and updated from file.' });
    res.status(200).json({ message: 'Database initialized successfully from JSON file.' });
});


// @desc    Get all error logs
// @route   GET /api/admin/logs
// @access  Admin or Editor
exports.getLogs = asyncHandler(async (req, res) => {
    const logs = await Log.find().sort({ createdAt: -1 }).limit(100); // Get latest 100 logs
    res.status(200).json(logs);
});