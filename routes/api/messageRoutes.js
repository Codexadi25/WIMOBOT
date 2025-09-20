const express = require('express');
const router = express.Router();
const Message = require('../../models/Message');
const User = require('../../models/User');
const { isAuthenticated, isAdmin } = require('../../middleware/authMiddleware');

// Get messages for current user
router.get('/my', isAuthenticated, async (req, res) => {
    try {
        const user = req.session.user;
        const messages = await Message.find({ isActive: true })
            .sort({ priority: -1, createdAt: -1 });
        
        // Filter messages that should be shown to this user
        const userMessages = messages.filter(message => message.shouldShowToUser(user));
        
        res.json(userMessages);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching messages', error: error.message });
    }
});

// Mark message as read
router.post('/:id/read', isAuthenticated, async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }
        
        // Check if already read
        const sessionUser = req.session.user || {};
        const currentUserId = sessionUser._id || sessionUser.id;
        const alreadyRead = message.isRead.find(read => String(read.userId) === String(currentUserId));
        if (!alreadyRead) {
            message.isRead.push({
                userId: currentUserId,
                readAt: new Date()
            });
            await message.save();
        }
        
        res.json({ message: 'Message marked as read' });
    } catch (error) {
        res.status(400).json({ message: 'Error marking message as read', error: error.message });
    }
});

// Get all messages (admin only)
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, type, priority } = req.query;
        const filter = {};
        
        if (type) filter.type = type;
        if (priority) filter.priority = priority;
        
        const messages = await Message.find(filter)
            .populate('authorId', 'username')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
        const total = await Message.countDocuments(filter);
        
        res.json({
            messages,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching messages', error: error.message });
    }
});

// Create new message (admin only)
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const {
            title,
            content,
            targetUsers = [],
            targetRoles = ['all'],
            priority = 'medium',
            type = 'info',
            endDate
        } = req.body;
        
        if (!endDate) {
            return res.status(400).json({ message: 'End date is required' });
        }
        
        const sessionUser = req.session.user || {};
        const currentUserId = sessionUser._id || sessionUser.id;
        const message = new Message({
            title,
            content,
            authorId: currentUserId,
            authorName: sessionUser.username,
            targetUsers,
            targetRoles,
            priority,
            type,
            endDate: new Date(endDate)
        });
        
        await message.save();
        res.status(201).json({ message: 'Message created successfully', data: message });
    } catch (error) {
        res.status(400).json({ message: 'Error creating message', error: error.message });
    }
});

// Update message (admin only)
router.put('/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const {
            title,
            content,
            targetUsers,
            targetRoles,
            priority,
            type,
            endDate,
            isActive
        } = req.body;
        
        const message = await Message.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }
        
        if (title) message.title = title;
        if (content) message.content = content;
        if (targetUsers) message.targetUsers = targetUsers;
        if (targetRoles) message.targetRoles = targetRoles;
        if (priority) message.priority = priority;
        if (type) message.type = type;
        if (endDate) message.endDate = new Date(endDate);
        if (isActive !== undefined) message.isActive = isActive;
        
        await message.save();
        res.json({ message: 'Message updated successfully', data: message });
    } catch (error) {
        res.status(400).json({ message: 'Error updating message', error: error.message });
    }
});

// Delete message (admin only)
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const message = await Message.findByIdAndDelete(req.params.id);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }
        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: 'Error deleting message', error: error.message });
    }
});

// Get all users for targeting (admin only)
router.get('/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const users = await User.find({}, 'username role');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
});

// Cleanup expired messages (admin only)
router.post('/cleanup', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await Message.deleteMany({
            endDate: { $lt: new Date() }
        });
        res.json({ message: `Cleaned up ${result.deletedCount} expired messages` });
    } catch (error) {
        res.status(500).json({ message: 'Error cleaning up messages', error: error.message });
    }
});

module.exports = router;

