const Message = require('../models/Message');

/**
 * Clean up expired messages from the database
 * This function should be called periodically (e.g., via cron job)
 */
async function cleanupExpiredMessages() {
    try {
        const result = await Message.deleteMany({
            endDate: { $lt: new Date() }
        });
        
        console.log(`Cleaned up ${result.deletedCount} expired messages`);
        return result.deletedCount;
    } catch (error) {
        console.error('Error cleaning up expired messages:', error);
        throw error;
    }
}

/**
 * Deactivate expired messages instead of deleting them
 * This preserves the message history for audit purposes
 */
async function deactivateExpiredMessages() {
    try {
        const result = await Message.updateMany(
            {
                endDate: { $lt: new Date() },
                isActive: true
            },
            {
                $set: { isActive: false }
            }
        );
        
        console.log(`Deactivated ${result.modifiedCount} expired messages`);
        return result.modifiedCount;
    } catch (error) {
        console.error('Error deactivating expired messages:', error);
        throw error;
    }
}

module.exports = {
    cleanupExpiredMessages,
    deactivateExpiredMessages
};

