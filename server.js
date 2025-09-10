const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config();

// --- Environment & Database Configuration ---
const mongoUri = process.env.MONGO_URI; 
if (!mongoUri) {
    console.error("MONGO_URI environment variable is not set!");
    process.exit(1);
}
const client = new MongoClient(mongoUri);
let db;
let usersCollection, categoriesCollection, pnCategoriesCollection;

// --- Server-Side Cache ---
let cache = { users: [], categories: [], pnCategories: [] };

// --- Cache Management Functions ---
async function updateCache() {
    console.log("Updating server cache...");
    const [users, categories, pnCategories] = await Promise.all([
        usersCollection.find().toArray(),
        categoriesCollection.find().toArray(),
        pnCategoriesCollection.find().toArray()
    ]);
    cache = { users, categories, pnCategories };
    console.log("Cache updated.");
    return cache;
}

// --- Main Database Connection Function ---
async function connectToDatabase() {
    try {
        await client.connect();
        console.log("Connected successfully to MongoDB Atlas");
        db = client.db("WIMOBotDB");
        usersCollection = db.collection("users");
        categoriesCollection = db.collection("categories");
        pnCategoriesCollection = db.collection("pn_categories");
        
        const adminUser = await usersCollection.findOne({ role: 'admin' });
        if (!adminUser) {
            console.log("No admin user found, creating one...");
            await usersCollection.insertOne({ username: 'admin', password: 'adminpassword', role: 'admin' });
        }
        await updateCache(); // Initial cache load
    } catch (err) {
        console.error("Failed to connect to MongoDB", err);
        process.exit(1);
    }
}

// --- WebSocket Setup ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;
app.use(express.static(__dirname));

// --- Broadcast Helper Functions ---
const broadcast = (data) => wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(JSON.stringify(data)));

const broadcastAllData = async () => {
    const updatedCache = await updateCache();
    broadcast({ type: 'data-updated', payload: updatedCache });
};

// --- WebSocket Connection Handling ---
wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.send(JSON.stringify({ type: 'initial-data', payload: cache })); // Send data from cache

    ws.on('message', async (message) => {
        try {
            const { type, payload, userId } = JSON.parse(message);
            const requestingUser = userId ? await usersCollection.findOne({ _id: new ObjectId(userId) }) : null;

            // --- Authorization Checks ---
            const isAdmin = requestingUser && requestingUser.role === 'admin';
            const canEdit = requestingUser && (requestingUser.role === 'admin' || requestingUser.role === 'editor');

            // --- CRUD & Registration Operations ---
            switch (type) {
                // Registration
                case 'register-user':
                    const existingUser = await usersCollection.findOne({ username: payload.username });
                    if (existingUser) {
                        ws.send(JSON.stringify({ type: 'register-fail', payload: 'Username already exists.' }));
                        return;
                    }
                    await usersCollection.insertOne({ ...payload, role: 'user' }); // New users are always 'user' role
                    ws.send(JSON.stringify({ type: 'register-success' }));
                    await updateCache(); // Update user cache after registration
                    break;

                // Template Categories (Editors & Admins)
                case 'create-category':
                    if (canEdit) await categoriesCollection.insertOne({ title: payload.title, templates: [] });
                    break;
                case 'update-category':
                    if (canEdit) await categoriesCollection.updateOne({ _id: new ObjectId(payload.categoryId) }, { $set: { title: payload.title } });
                    break;
                case 'delete-category':
                    if (canEdit) await categoriesCollection.deleteOne({ _id: new ObjectId(payload.categoryId) });
                    break;

                // Templates (Editors & Admins)
                case 'create-template':
                    if (canEdit) await categoriesCollection.updateOne({ _id: new ObjectId(payload.categoryId) }, { $push: { templates: { ...payload.template, _id: new ObjectId() } } });
                    break;
                case 'update-template':
                    if (canEdit) await categoriesCollection.updateOne({ _id: new ObjectId(payload.categoryId), "templates._id": new ObjectId(payload.template._id) }, { $set: { "templates.$": payload.template } });
                    break;
                case 'delete-template':
                    if (canEdit) await categoriesCollection.updateOne({ _id: new ObjectId(payload.categoryId) }, { $pull: { templates: { _id: new ObjectId(payload.templateId) } } });
                    break;
                
                // Users (Admins Only)
                case 'create-user':
                    if (isAdmin) await usersCollection.insertOne(payload.user);
                    break;
                case 'update-user':
                    if (isAdmin) await usersCollection.updateOne({ _id: new ObjectId(payload.userId) }, { $set: payload.updates });
                    break;
                case 'delete-user':
                    if (isAdmin) await usersCollection.deleteOne({ _id: new ObjectId(payload.userId) });
                    break;
                
                // PN Categories & Notes (Editors & Admins)
                case 'create-pn-category':
                    if (canEdit) await pnCategoriesCollection.insertOne({ title: payload.title, notes: [] });
                    break;
                case 'update-pn-category':
                    if (canEdit) await pnCategoriesCollection.updateOne({ _id: new ObjectId(payload.categoryId) }, { $set: { title: payload.title } });
                    break;
                case 'delete-pn-category':
                    if (canEdit) await pnCategoriesCollection.deleteOne({ _id: new ObjectId(payload.categoryId) });
                    break;
                case 'create-pn-note':
                    if (canEdit) await pnCategoriesCollection.updateOne({ _id: new ObjectId(payload.categoryId) }, { $push: { notes: { ...payload.note, _id: new ObjectId() } } });
                    break;
                case 'update-pn-note':
                    if (canEdit) await pnCategoriesCollection.updateOne({ _id: new ObjectId(payload.categoryId), "notes._id": new ObjectId(payload.note._id) }, { $set: { "notes.$": payload.note } });
                    break;
                case 'delete-pn-note':
                    if (canEdit) await pnCategoriesCollection.updateOne({ _id: new ObjectId(payload.categoryId) }, { $pull: { notes: { _id: new ObjectId(payload.noteId) } } });
                    break;
            }
            
            // After any change, update cache and broadcast the fresh state to all clients
            if (type !== 'register-user') {
                await broadcastAllData();
            }
        } catch (e) {
            console.error('Failed to process message or update data:', e);
            ws.send(JSON.stringify({ type: 'error', payload: 'An error occurred on the server.' }));
        }
    });

    ws.on('close', () => console.log('Client disconnected'));
});


// --- Start Server ---
connectToDatabase().then(() => {
    server.listen(PORT, () => console.log(`Server is listening on http://localhost:${PORT}`));
});