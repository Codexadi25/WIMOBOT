const Log = require('../models/Log');

const errorHandler = async (err, req, res, next) => {
    const statusCode = res.statusCode ? res.statusCode : 500;
    
    // Log the error to the database
    try {
        await Log.create({
            level: 'error',
            message: err.message,
            stack: err.stack,
            user: req.session.user ? req.session.user.id : null
        });
    } catch (dbError) {
        console.error('Failed to write to log database:', dbError);
    }
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
        console.error(err.stack);
    }

    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = { errorHandler };