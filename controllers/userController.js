const User = require('../models/User');
const { broadcastUpdate } = require('../utils/webSocketServer');
const asyncHandler = require('express-async-handler'); // Simple async wrapper

// @desc    Get all users
// @route   GET /api/users
// @access  Admin
exports.getUsers = asyncHandler(async (req, res) => {
    const users = await User.find({}).select('-password');
    res.status(200).json(users);
});

// @desc    Create a new user
// @route   POST /api/users
// @access  Admin
exports.createUser = asyncHandler(async (req, res) => {
    const { username, password, role } = req.body;
    const userExists = await User.findOne({ username });

    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const user = await User.create({ username, password, role });
    if (user) {
        broadcastUpdate({ type: 'USER_CREATED', user: { _id: user._id, username: user.username, role: user.role } });
        res.status(201).json({ _id: user._id, username: user.username, role: user.role });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// @desc    Update a user
// @route   PUT /api/users/:id
// @access  Admin
exports.updateUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        user.username = req.body.username || user.username;
        user.role = req.body.role || user.role;
        if (req.body.password) {
            user.password = req.body.password; // The pre-save hook will hash it
        }
        const updatedUser = await user.save();
        broadcastUpdate({ type: 'USER_UPDATED' });
        res.json({ _id: updatedUser._id, username: updatedUser.username, role: updatedUser.role });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Admin
exports.deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        if (user.role === 'admin') {
            res.status(400);
            throw new Error('Cannot delete an admin account.');
        }
        await user.deleteOne();
        broadcastUpdate({ type: 'USER_DELETED' });
        res.json({ message: 'User removed' });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});


// @desc    Bulk create users from a list of usernames
// @route   POST /api/users/bulk
// @access  Admin
exports.bulkCreateUsers = asyncHandler(async (req, res) => {
    const { usernames } = req.body; // Expecting an array of strings
    if (!usernames || !Array.isArray(usernames)) {
        res.status(400);
        throw new Error('Invalid input: "usernames" array is required.');
    }

    const createdUsers = [];
    const failedUsers = [];

    for (const username of usernames) {
        const cleanUsername = username.trim();
        if (cleanUsername) {
            const userExists = await User.findOne({ username: cleanUsername });
            if (!userExists) {
                // Password is the same as the username by default
                const newUser = new User({ username: cleanUsername, password: cleanUsername });
                await newUser.save();
                createdUsers.push({ username: newUser.username, password: cleanUsername }); // Send back plain text password
            } else {
                failedUsers.push({ username: cleanUsername, reason: 'Already exists' });
            }
        }
    }

    broadcastUpdate({ type: 'USERS_BULK_CREATED' });
    res.status(201).json({
        message: 'Bulk user creation process completed.',
        createdUsers,
        failedUsers
    });
});