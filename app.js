// Load environment variables
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const { initializeWebSocketServer } = require('./utils/webSocketServer');
const { errorHandler } = require('./middleware/errorMiddleware');
const connectDB = require('./config/database');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize WebSocket Server and attach it to the app instance
const wss = initializeWebSocketServer(server);
app.set('wss', wss);

// EJS View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // Set to false to prevent empty sessions
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Middleware to make user available in all templates
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// --- Routes ---
app.use('/', require('./routes/viewRoutes'));
app.use('/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/api/userRoutes'));
app.use('/api/cands', require('./routes/api/candRoutes'));
app.use('/api/pns', require('./routes/api/pnRoutes'));
app.use('/api/admin', require('./routes/api/adminRoutes'));

// Global Error Handler (should be the last middleware)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));