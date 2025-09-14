const PrivateNote = require('../models/PrivateNote');
const Logger = require('../utils/logger');
const asyncHandler = require('express-async-handler');

exports.getNotes = asyncHandler(async (req, res) => {
    const notes = await PrivateNote.find({ user: req.session.user.id });
    res.json(notes);
});

exports.createNote = asyncHandler(async (req, res) => {
    const { title, content, category } = req.body;
    const note = await PrivateNote.create({
        title,
        content,
        category,
        user: req.session.user.id
    });
    
    // Log database change
    await Logger.logDatabaseChange('CREATE', 'PrivateNote', note._id.toString(), null, { title, content, category }, req.session.user.id, req.session.user.username, {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
    });
    
    res.status(201).json(note);
});

exports.updateNote = asyncHandler(async (req, res) => {
    const note = await PrivateNote.findById(req.params.id);

    if (note && note.user.toString() === req.session.user.id) {
        const oldData = { title: note.title, content: note.content, category: note.category };
        note.title = req.body.title || note.title;
        note.content = req.body.content || note.content;
        note.category = req.body.category || note.category;
        const updatedNote = await note.save();
        
        // Log database change
        await Logger.logDatabaseChange('UPDATE', 'PrivateNote', note._id.toString(), oldData, { title: note.title, content: note.content, category: note.category }, req.session.user.id, req.session.user.username, {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        });
        
        res.json(updatedNote);
    } else {
        res.status(404);
        throw new Error('Note not found or user not authorized');
    }
});

exports.deleteNote = asyncHandler(async (req, res) => {
    const note = await PrivateNote.findById(req.params.id);

    if (note && note.user.toString() === req.session.user.id) {
        const oldData = { title: note.title, content: note.content, category: note.category };
        await note.deleteOne();
        
        // Log database change
        await Logger.logDatabaseChange('DELETE', 'PrivateNote', req.params.id, oldData, null, req.session.user.id, req.session.user.username, {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        });
        
        res.json({ message: 'Note removed' });
    } else {
        res.status(404);
        throw new Error('Note not found or user not authorized');
    }
});