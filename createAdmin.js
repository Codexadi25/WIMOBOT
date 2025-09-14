// This script creates the initial admin user in your database.

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User'); // Adjust path if your models are elsewhere
const connectDB = require('./config/database');

const createAdminUser = async () => {
    await connectDB();

    try {
        const adminExists = await User.findOne({ username: 'admin' });
        const userExists = await User.findOne({ username: 'user' });
        const editorExists = await User.findOne({ username: 'editor' });

        if (adminExists || userExists || editorExists) {
            console.log('✅ User already exists.');
            return;
        }

        // Create admin user
        await User.create({
            username: 'admin',
            password: 'adminpass', // The model will hash this automatically
            role: 'admin'
        });

        console.log('🎉 Success! Admin user created.');
        console.log('Username: admin');
        console.log('Password: adminpass');

        // Create user user
        await User.create({
            username: 'user',
            password: 'userpassword', // The model will hash this automatically
            role: 'user'
        });

        console.log('🎉 Success! User created.');
        console.log('Username: user');
        console.log('Password: userpassword');

        // Create editor user
        await User.create({
            username: 'editor',
            password: 'editorpass', // The model will hash this automatically
            role: 'editor'
        });

        console.log('🎉 Success! Editor user created.');
        console.log('Username: editor');
        console.log('Password: editorpass');

    } catch (error) {
        console.error('❌ Error creating admin user:', error);
    } finally {
        mongoose.disconnect();
        console.log('Disconnected from database.');
    }
};

createAdminUser();