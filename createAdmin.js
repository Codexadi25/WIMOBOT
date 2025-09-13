// This script creates the initial admin user in your database.

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User'); // Adjust path if your models are elsewhere
const connectDB = require('./config/database');

const createAdminUser = async () => {
    await connectDB();

    try {
        const adminExists = await User.findOne({ username: 'admin' });

        if (adminExists) {
            console.log('✅ Admin user already exists.');
            return;
        }

        await User.create({
            username: 'admin',
            password: 'adminpass', // The model will hash this automatically
            role: 'admin'
        });

        console.log('🎉 Success! Admin user created.');
        console.log('Username: admin');
        console.log('Password: adminpass');

    } catch (error) {
        console.error('❌ Error creating admin user:', error);
    } finally {
        mongoose.disconnect();
        console.log('Disconnected from database.');
    }
};

createAdminUser();