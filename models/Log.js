const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    level: { 
        type: String, 
        enum: ['info', 'warn', 'error', 'debug', 'database', 'timeout'], 
        default: 'error' 
    },
    message: { type: String, required: true },
    description: { type: String }, // Detailed description for dropdown
    stack: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // User who caused the action/error
    username: { type: String }, // Username for quick reference
    action: { type: String }, // CRUD action performed
    resource: { type: String }, // Resource affected (Category, Cand, PN, etc.)
    resourceId: { type: String }, // ID of the affected resource
    oldData: { type: mongoose.Schema.Types.Mixed }, // Previous data for changes
    newData: { type: mongoose.Schema.Types.Mixed }, // New data for changes
    ip: { type: String }, // User's IP address
    userAgent: { type: String }, // User's browser info
    responseTime: { type: Number }, // API response time in ms
    statusCode: { type: Number }, // HTTP status code
    errorCode: { type: String }, // Custom error code
    severity: { 
        type: String, 
        enum: ['low', 'medium', 'high', 'critical'], 
        default: 'medium' 
    }
}, { timestamps: true });

module.exports = mongoose.model('Log', logSchema);