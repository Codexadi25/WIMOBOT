const Category = require('../models/Category');
const { broadcastUpdate } = require('../utils/webSocketServer');
const { generateTags } = require('../utils/autoTagGenerator');
const Logger = require('../utils/logger');
const asyncHandler = require('express-async-handler');

// CATEGORY CONTROLLERS //
exports.createCategory = asyncHandler(async (req, res) => {
    const { title } = req.body;
    const category = await Category.create({ title });
    
    // Log database change
    await Logger.logDatabaseChange('CREATE', 'Category', category._id.toString(), null, { title }, req.session.user.id, req.session.user.username, {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
    });
    
    broadcastUpdate({ message: 'A new category was created.' });
    res.status(201).json(category);
});

exports.updateCategory = asyncHandler(async (req, res) => {
    const oldCategory = await Category.findById(req.params.id);
    const category = await Category.findByIdAndUpdate(req.params.id, { title: req.body.title }, { new: true });
    
    // Log database change
    await Logger.logDatabaseChange('UPDATE', 'Category', category._id.toString(), { title: oldCategory.title }, { title: category.title }, req.session.user.id, req.session.user.username, {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
    });
    
    broadcastUpdate({ message: `Category "${category.title}" was updated.` });
    res.json(category);
});

exports.deleteCategory = asyncHandler(async (req, res) => {
    const oldCategory = await Category.findById(req.params.id);
    await Category.findByIdAndDelete(req.params.id);
    
    // Log database change
    await Logger.logDatabaseChange('DELETE', 'Category', req.params.id, { title: oldCategory.title }, null, req.session.user.id, req.session.user.username, {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
    });
    
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
        
        // Log database change
        const newTemplate = category.templates[category.templates.length - 1];
        await Logger.logDatabaseChange('CREATE', 'Template', newTemplate._id.toString(), null, { text, tags: finalTags }, req.session.user.id, req.session.user.username, {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            resourceId: category._id.toString()
        });
        
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
        const oldData = { text: template.text, tags: template.tags };
        template.text = req.body.text;
        template.tags = req.body.tags;
        await category.save();
        
        // Log database change
        await Logger.logDatabaseChange('UPDATE', 'Template', req.params.templateId, oldData, { text: template.text, tags: template.tags }, req.session.user.id, req.session.user.username, {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            resourceId: category._id.toString()
        });
        
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
        const template = category.templates.id(req.params.templateId);
        const oldData = { text: template.text, tags: template.tags };
        category.templates.id(req.params.templateId).deleteOne();
        await category.save();
        
        // Log database change
        await Logger.logDatabaseChange('DELETE', 'Template', req.params.templateId, oldData, null, req.session.user.id, req.session.user.username, {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            resourceId: category._id.toString()
        });
        
        broadcastUpdate({ message: 'A template was deleted.' });
        res.json({ message: 'Template removed' });
    } else {
        res.status(404);
        throw new Error('Category not found');
    }
});