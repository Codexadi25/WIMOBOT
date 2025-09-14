const mongoose = require('mongoose');

const pnCategorySchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

module.exports = mongoose.model('PNCategory', pnCategorySchema);