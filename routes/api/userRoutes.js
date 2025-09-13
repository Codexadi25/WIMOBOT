const express = require('express');
const router = express.Router();
const { createUser, getUsers, updateUser, deleteUser, bulkCreateUsers } = require('../../controllers/userController');
const { isAdmin } = require('../../middleware/authMiddleware');

router.route('/')
    .get(isAdmin, getUsers)
    .post(isAdmin, createUser);

router.post('/bulk', isAdmin, bulkCreateUsers); // For bulk user creation

router.route('/:id')
    .put(isAdmin, updateUser)
    .delete(isAdmin, deleteUser);

module.exports = router;