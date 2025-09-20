const express = require('express');
const router = express.Router();
const Feedback = require('../../models/Feedback');
const { isAuthenticated, isAdmin } = require('../../middleware/authMiddleware');

// Get all feedback (visible to all users)
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const { type, status, page = 1, limit = 20 } = req.query;
        const filter = {};
        
        if (type) filter.type = type;
        if (status) filter.status = status;
        
        const feedback = await Feedback.find(filter)
            .populate('userId', 'username')
            .populate('adminId', 'username')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
        const total = await Feedback.countDocuments(filter);
        
        res.json({
            feedback,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching feedback', error: error.message });
    }
});

// Get user's own feedback
router.get('/my', isAuthenticated, async (req, res) => {
    try {
        const sessionUser = req.session.user || {};
        const currentUserId = sessionUser._id || sessionUser.id;
        const feedback = await Feedback.find({ userId: currentUserId })
            .populate('adminId', 'username')
            .sort({ createdAt: -1 });
        res.json(feedback);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching your feedback', error: error.message });
    }
});

// Submit new feedback
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { type, title, description, priority = 'medium', tags = [], isPublic = false } = req.body;
        const sessionUser = req.session.user || {};
        const currentUserId = sessionUser._id || sessionUser.id;
        
        const feedback = new Feedback({
            userId: currentUserId,
            username: sessionUser.username,
            type,
            title,
            description,
            priority,
            tags,
            isPublic
        });
        
        await feedback.save();
        res.status(201).json({ message: 'Feedback submitted successfully', feedback });
    } catch (error) {
        res.status(400).json({ message: 'Error submitting feedback', error: error.message });
    }
});

// Update feedback status (admin/editor only)
router.put('/:id/status', isAuthenticated, async (req, res) => {
    try {
        const { status, adminResponse } = req.body;
        const sessionUser = req.session.user || {};
        
        // Check if user has admin or editor role
        if (sessionUser.role !== 'admin' && sessionUser.role !== 'editor') {
            return res.status(403).json({ message: 'Access denied. Admin or Editor role required.' });
        }
        
        const feedback = await Feedback.findById(req.params.id);
        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }
        
        feedback.status = status;
        if (adminResponse) feedback.adminResponse = adminResponse;
        feedback.adminId = sessionUser._id || sessionUser.id;
        
        await feedback.save();
        res.json({ message: 'Feedback status updated', feedback });
    } catch (error) {
        res.status(400).json({ message: 'Error updating feedback', error: error.message });
    }
});

// Vote on feedback
router.post('/:id/vote', isAuthenticated, async (req, res) => {
    try {
        const { voteType } = req.body; // 'upvote' or 'downvote'
        const feedback = await Feedback.findById(req.params.id);
        
        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }
        
        if (!feedback.isPublic) {
            return res.status(403).json({ message: 'Cannot vote on private feedback' });
        }
        
        const sessionUser = req.session.user || {};
        const userId = sessionUser._id || sessionUser.id;
        
        // Remove existing votes
        feedback.upvotes = feedback.upvotes.filter(id => String(id) !== String(userId));
        feedback.downvotes = feedback.downvotes.filter(id => String(id) !== String(userId));
        
        // Add new vote
        if (voteType === 'upvote') {
            feedback.upvotes.push(userId);
        } else if (voteType === 'downvote') {
            feedback.downvotes.push(userId);
        }
        
        await feedback.save();
        res.json({ message: 'Vote recorded', feedback });
    } catch (error) {
        res.status(400).json({ message: 'Error voting on feedback', error: error.message });
    }
});

// Delete feedback (admin only)
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const feedback = await Feedback.findByIdAndDelete(req.params.id);
        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }
        res.json({ message: 'Feedback deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: 'Error deleting feedback', error: error.message });
    }
});

module.exports = router;

