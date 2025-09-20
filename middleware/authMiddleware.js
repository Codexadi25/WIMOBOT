const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    // Return JSON for API requests, redirect for views
    const isApi = req.originalUrl && req.originalUrl.startsWith('/api');
    if (isApi) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    res.redirect('/login');
};

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.status(403).json({ message: 'Forbidden: Admin access required.' });
};

const isEditorOrAdmin = (req, res, next) => {
    if (req.session.user && (req.session.user.role === 'editor' || req.session.user.role === 'admin')) {
        return next();
    }
    res.status(403).json({ message: 'Forbidden: Editor or Admin access required.' });
};


module.exports = { isAuthenticated, isAdmin, isEditorOrAdmin };