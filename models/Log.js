const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    level: { type: String, enum: ['info', 'warn', 'error'], default: 'error' },
    message: { type: String, required: true },
    stack: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // User who caused the error, if applicable
}, { timestamps: true });

module.exports = mongoose.model('Log', logSchema);