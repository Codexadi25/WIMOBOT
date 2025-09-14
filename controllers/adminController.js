const Category = require('../models/Category');
const Log = require('../models/Log');
const User = require('../models/User');
const { broadcastUpdate } = require('../utils/webSocketServer');
const Logger = require('../utils/logger');
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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


// @desc    Get all logs with filtering
// @route   GET /api/admin/logs
// @access  Admin or Editor
exports.getLogs = asyncHandler(async (req, res) => {
    const { level, severity, limit = 100 } = req.query;
    
    let query = {};
    if (level && level !== 'all') {
        query.level = level;
    }
    if (severity) {
        query.severity = severity;
    }
    
    const logs = await Log.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));
    
    res.status(200).json(logs);
});

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Admin
exports.getUsers = asyncHandler(async (req, res) => {
    const users = await User.find({}).select('-password').sort({ username: 1 });
    res.status(200).json(users);
});

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Admin
exports.updateUserRole = asyncHandler(async (req, res) => {
    const { role } = req.body;
    const userId = req.params.id;
    
    if (!['user', 'editor', 'admin'].includes(role)) {
        res.status(400);
        throw new Error('Invalid role. Must be user, editor, or admin');
    }
    
    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    
    const oldRole = user.role;
    user.role = role;
    await user.save();
    
    // Log role change
    await Logger.logDatabaseChange('UPDATE', 'User', userId, { role: oldRole }, { role }, req.session.user.id, req.session.user.username, {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        description: `User role changed from ${oldRole} to ${role}`
    });
    
    res.status(200).json({ message: 'User role updated successfully', user: { id: user._id, username: user.username, role: user.role } });
});

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Admin
exports.deleteUser = asyncHandler(async (req, res) => {
    const userId = req.params.id;
    
    // Prevent admin from deleting themselves
    if (userId === req.session.user.id) {
        res.status(400);
        throw new Error('Cannot delete your own account');
    }
    
    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    
    // Log user deletion
    await Logger.logDatabaseChange('DELETE', 'User', userId, { username: user.username, role: user.role }, null, req.session.user.id, req.session.user.username, {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        description: `User ${user.username} deleted`
    });
    
    await User.findByIdAndDelete(userId);
    res.status(200).json({ message: 'User deleted successfully' });
});

// @desc    Clean up old logs (30 days or 100 logs)
// @route   POST /api/admin/cleanup-logs
// @access  Admin
exports.cleanupLogs = asyncHandler(async (req, res) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Delete logs older than 30 days
    const deletedOldLogs = await Log.deleteMany({
        createdAt: { $lt: thirtyDaysAgo }
    });
    
    // Keep only the latest 100 logs
    const totalLogs = await Log.countDocuments();
    if (totalLogs > 100) {
        const logsToDelete = totalLogs - 100;
        const oldestLogs = await Log.find().sort({ createdAt: 1 }).limit(logsToDelete);
        const oldestLogIds = oldestLogs.map(log => log._id);
        await Log.deleteMany({ _id: { $in: oldestLogIds } });
    }
    
    // Log cleanup action
    await Logger.logInfo(`Log cleanup performed: ${deletedOldLogs.deletedCount} old logs deleted`, {
        user: req.session.user.id,
        username: req.session.user.username,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        action: 'CLEANUP',
        resource: 'Logs'
    });
    
    res.status(200).json({ 
        message: 'Log cleanup completed successfully',
        deletedOldLogs: deletedOldLogs.deletedCount
    });
});

// @desc    Update user password (admin sets a new password)
// @route   PUT /api/admin/users/:id/password
// @access  Admin
exports.updateUserPassword = asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const { newPassword } = req.body || {};

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        res.status(400);
        throw new Error('Password must be at least 6 characters long.');
    }

    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await Logger.logDatabaseChange('UPDATE', 'User', userId, { password: '***' }, { password: '***' }, req.session.user.id, req.session.user.username, {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        description: 'Admin updated user password'
    });

    res.status(200).json({ message: 'Password updated successfully' });
});

// @desc    Reset user password and return a temporary password (admin action)
// @route   POST /api/admin/users/:id/reset-password
// @access  Admin
exports.resetUserPassword = asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // generate a secure temporary password (12 chars)
    const tempPassword = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(tempPassword, salt);
    await user.save();

    await Logger.logDatabaseChange('UPDATE', 'User', userId, { password: '***' }, { password: '***' }, req.session.user.id, req.session.user.username, {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        description: 'Admin reset user password'
    });

    // return the temporary plain password once (admin should copy/save it)
    res.status(200).json({ message: 'Password reset successfully', tempPassword });
});