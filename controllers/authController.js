const User = require('../models/User');
const Category = require('../models/Category');
const PrivateNote = require('../models/PrivateNote');

// @desc    Show login page
// @route   GET /login
exports.getLoginPage = (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('login', { error: null });
};

// @desc    Authenticate user & get token
// @route   POST /auth/login
exports.loginUser = async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username: username.toLowerCase() });

        if (user && (await user.matchPassword(password))) {
            // Create session
            req.session.user = {
                id: user._id,
                username: user.username,
                role: user.role,
            };
            res.redirect('/');
        } else {
            res.render('login', { error: 'Invalid username or password' });
        }
    } catch (error) {
        res.render('login', { error: 'An error occurred. Please try again.' });
    }
};

// @desc    Logout user
// @route   GET /auth/logout
exports.logoutUser = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); // The default session cookie name
        res.redirect('/login');
    });
};

// @desc    Show main application page
// @route   GET /
exports.getAppPage = async (req, res) => {
    try {
        const categories = await Category.find().sort({ title: 1 });
        const privateNotes = await PrivateNote.find({ user: req.session.user.id }).sort({ createdAt: -1 });

        // Aggregate all unique tags
        const allTags = new Set();
        categories.forEach(cat => {
            cat.templates.forEach(tpl => {
                tpl.tags.forEach(tag => allTags.add(tag));
            });
        });
        
        res.render('index', {
            categories: categories,
            privateNotes: privateNotes,
            allTags: [...allTags].sort(),
            user: req.session.user
        });
    } catch (error) {
        // Render an error page or redirect
        res.status(500).send("Could not load application data.");
    }
};