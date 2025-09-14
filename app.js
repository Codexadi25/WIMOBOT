require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const connectDB = require('./config/database');
const { initializeWebSocketServer } = require('./utils/webSocketServer');
const { errorHandler } = require('./middleware/errorMiddleware');
const requestLogger = require('./middleware/requestLogger');
const authRouter = require('./routes/auth');

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize WebSocket Server
const wss = initializeWebSocketServer(server);
app.set('wss', wss); // Make WSS available in controllers

// EJS Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(requestLogger); // Add request logging middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Routes
app.use('/', authRouter);
app.use('/', require('./routes/viewRoutes'));
app.use('/auth', require('./routes/authRoutes'));
app.use('/api/cands', require('./routes/api/candRoutes'));
// ... other API routes

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));