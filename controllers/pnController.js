const PrivateNote = require('../models/PrivateNote');
const asyncHandler = require('express-async-handler');

exports.getNotes = asyncHandler(async (req, res) => {
    const notes = await PrivateNote.find({ user: req.session.user.id });
    res.json(notes);
});

exports.createNote = asyncHandler(async (req, res) => {
    const { title, content, tags } = req.body;
    const note = await PrivateNote.create({
        title,
        content,
        tags,
        user: req.session.user.id
    });
    res.status(201).json(note);
});

exports.updateNote = asyncHandler(async (req, res) => {
    const note = await PrivateNote.findById(req.params.id);

    if (note && note.user.toString() === req.session.user.id) {
        note.title = req.body.title || note.title;
        note.content = req.body.content || note.content;
        note.tags = req.body.tags || note.tags;
        const updatedNote = await note.save();
        res.json(updatedNote);
    } else {
        res.status(404);
        throw new Error('Note not found or user not authorized');
    }
});

exports.deleteNote = asyncHandler(async (req, res) => {
    const note = await PrivateNote.findById(req.params.id);

    if (note && note.user.toString() === req.session.user.id) {
        await note.deleteOne();
        res.json({ message: 'Note removed' });
    } else {
        res.status(404);
        throw new Error('Note not found or user not authorized');
    }
});