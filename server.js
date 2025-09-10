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

// --- Main Database Connection Function ---
async function connectToDatabase() {
    try {
        await client.connect();
        console.log("Connected successfully to MongoDB Atlas");
        db = client.db("WIMOBotDB");
        usersCollection = db.collection("users");
        categoriesCollection = db.collection("categories");
        pnCategoriesCollection = db.collection("pn_categories");

        // Ensure at least one admin user exists
        const adminUser = await usersCollection.findOne({ role: 'admin' });
        if (!adminUser) {
            console.log("No admin user found, creating one...");
            await usersCollection.insertOne({ username: 'admin', password: 'adminpassword', role: 'admin' });
        }
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
    const [users, categories, pnCategories] = await Promise.all([
        usersCollection.find().toArray(),
        categoriesCollection.find().toArray(),
        pnCategoriesCollection.find().toArray()
    ]);
    broadcast({ type: 'data-updated', payload: { users, categories, pnCategories } });
};
const broadcastInitialData = async (ws) => {
    const [users, categories, pnCategories] = await Promise.all([
        usersCollection.find().toArray(),
        categoriesCollection.find().toArray(),
        pnCategoriesCollection.find().toArray()
    ]);
    ws.send(JSON.stringify({ type: 'initial-data', payload: { users, categories, pnCategories } }));
};


// --- WebSocket Connection Handling ---
wss.on('connection', (ws) => {
    console.log('Client connected');
    broadcastInitialData(ws);

    ws.on('message', async (message) => {
        try {
            const { type, payload, userId } = JSON.parse(message);
            const requestingUser = userId ? await usersCollection.findOne({ _id: new ObjectId(userId) }) : null;

            // Simple Auth Check for protected routes
            const isAdmin = requestingUser && requestingUser.role === 'admin';

            // --- CRUD Operations ---
            switch (type) {
                // Template Categories
                case 'create-category':
                    if (isAdmin) await categoriesCollection.insertOne({ title: payload.title, templates: [] });
                    break;
                case 'update-category':
                    if (isAdmin) await categoriesCollection.updateOne({ _id: new ObjectId(payload.categoryId) }, { $set: { title: payload.title } });
                    break;
                case 'delete-category':
                    if (isAdmin) await categoriesCollection.deleteOne({ _id: new ObjectId(payload.categoryId) });
                    break;

                // Templates
                case 'create-template':
                    if (isAdmin) await categoriesCollection.updateOne({ _id: new ObjectId(payload.categoryId) }, { $push: { templates: { ...payload.template, _id: new ObjectId() } } });
                    break;
                case 'update-template':
                    if (isAdmin) await categoriesCollection.updateOne(
                        { _id: new ObjectId(payload.categoryId), "templates._id": new ObjectId(payload.template._id) },
                        { $set: { "templates.$": payload.template } }
                    );
                    break;
                case 'delete-template':
                    if (isAdmin) await categoriesCollection.updateOne({ _id: new ObjectId(payload.categoryId) }, { $pull: { templates: { _id: new ObjectId(payload.templateId) } } });
                    break;
                
                // Users (Admin Only)
                case 'create-user':
                    if (isAdmin) await usersCollection.insertOne(payload.user);
                    break;
                case 'update-user':
                    if (isAdmin) await usersCollection.updateOne({ _id: new ObjectId(payload.userId) }, { $set: payload.updates });
                    break;
                case 'delete-user':
                    if (isAdmin) await usersCollection.deleteOne({ _id: new ObjectId(payload.userId) });
                    break;
                
                // --- PN Categories ---
                case 'create-pn-category':
                    await pnCategoriesCollection.insertOne({ title: payload.title, notes: [] });
                    break;
                case 'update-pn-category':
                    await pnCategoriesCollection.updateOne({ _id: new ObjectId(payload.categoryId) }, { $set: { title: payload.title } });
                    break;
                case 'delete-pn-category':
                    await pnCategoriesCollection.deleteOne({ _id: new ObjectId(payload.categoryId) });
                    break;

                // --- PN Notes ---
                case 'create-pn-note':
                    await pnCategoriesCollection.updateOne({ _id: new ObjectId(payload.categoryId) }, { $push: { notes: { ...payload.note, _id: new ObjectId() } } });
                    break;
                case 'update-pn-note':
                    await pnCategoriesCollection.updateOne(
                        { _id: new ObjectId(payload.categoryId), "notes._id": new ObjectId(payload.note._id) },
                        { $set: { "notes.$": payload.note } }
                    );
                    break;
                case 'delete-pn-note':
                    await pnCategoriesCollection.updateOne({ _id: new ObjectId(payload.categoryId) }, { $pull: { notes: { _id: new ObjectId(payload.noteId) } } });
                    break;
            }
            
            // After any change, broadcast the fresh state to all clients
            await broadcastAllData();

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