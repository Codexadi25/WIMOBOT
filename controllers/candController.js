const Category = require('../models/Category');
const { broadcastUpdate } = require('../utils/webSocketServer');
const { generateTags } = require('../utils/autoTagGenerator');
const asyncHandler = require('express-async-handler');

// CATEGORY CONTROLLERS //
exports.createCategory = asyncHandler(async (req, res) => {
    const { title } = req.body;
    const category = await Category.create({ title });
    broadcastUpdate({ message: 'A new category was created.' });
    res.status(201).json(category);
});

exports.updateCategory = asyncHandler(async (req, res) => {
    const category = await Category.findByIdAndUpdate(req.params.id, { title: req.body.title }, { new: true });
    broadcastUpdate({ message: `Category "${category.title}" was updated.` });
    res.json(category);
});

exports.deleteCategory = asyncHandler(async (req, res) => {
    await Category.findByIdAndDelete(req.params.id);
    broadcastUpdate({ message: 'A category was deleted.' });
    res.json({ message: 'Category deleted' });
});


// TEMPLATE CONTROLLERS //
exports.addTemplate = asyncHandler(async (req, res) => {
    const { text, tags } = req.body;
    const category = await Category.findById(req.params.categoryId);
    
    if (category) {
        const autoTags = generateTags(text);
        const finalTags = [...new Set([...(tags || []), ...autoTags])];

        category.templates.push({ text, tags: finalTags });
        await category.save();
        broadcastUpdate({ message: 'A new template was added.' });
        res.status(201).json(category);
    } else {
        res.status(404);
        throw new Error('Category not found');
    }
});

exports.updateTemplate = asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.categoryId);
    if (category) {
        const template = category.templates.id(req.params.templateId);
        template.text = req.body.text;
        template.tags = req.body.tags;
        await category.save();
        broadcastUpdate({ message: 'A template was updated.' });
        res.json(template);
    } else {
        res.status(404);
        throw new Error('Category or template not found');
    }
});

exports.deleteTemplate = asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.categoryId);
    if (category) {
        category.templates.id(req.params.templateId).deleteOne();
        await category.save();
        broadcastUpdate({ message: 'A template was deleted.' });
        res.json({ message: 'Template removed' });
    } else {
        res.status(404);
        throw new Error('Category not found');
    }
});