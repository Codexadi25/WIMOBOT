document.addEventListener('DOMContentLoaded', function() {
    // --- Application State ---
    let currentUser = null;
    let users = [], categories = [], pnCategories = [];
    let activeCategoryId = null;
    let activePnCategoryId = null; // State for PN category
    let ws;

    // --- DOM Getters ---
    const getEl = (id) => document.getElementById(id);
    const loginOverlay = getEl('login-overlay'), loginForm = getEl('login-form'), loginError = getEl('login-error');
    const appWrapper = getEl('app-wrapper'), searchBar = getEl('search-bar'), userRoleDisplay = getEl('user-role-display');
    const templatesTabBtn = getEl('templates-tab-btn'), pnsTabBtn = getEl('pns-tab-btn'), adminTabBtn = getEl('admin-tab-btn');
    const templatesView = getEl('templates-view'), pnsView = getEl('pns-view'), adminView = getEl('admin-view');
    const modalOverlay = getEl('modal-overlay'), modalTitle = getEl('modal-title'), modalContent = getEl('modal-content'), modalSaveBtn = getEl('modal-save-btn');
    const toastContainer = getEl('toast-container');
    
    // --- WebSocket Connection & Communication ---
    function connect() {
        ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`);
        ws.onopen = () => console.log('Connected to WebSocket server.');
        ws.onclose = () => setTimeout(connect, 5000);
        ws.onmessage = handleSocketMessage;
    }

    function handleSocketMessage(event) {
        const { type, payload } = JSON.parse(event.data);
        switch (type) {
            case 'initial-data':
            case 'data-updated':
                users = payload.users;
                categories = payload.categories;
                pnCategories = payload.pnCategories;
                if (currentUser) renderCurrentView();
                break;
            case 'error':
                showToast(payload, 'error');
                break;
        }
    }

    const sendSocketMessage = (type, payload) => ws.send(JSON.stringify({ type, payload, userId: currentUser._id }));

    // --- Toast Notifications ---
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }, 10);
    }
    
    // --- Modal Logic ---
    let onModalSave = null;
    function showModal(title, contentHtml, onSave) {
        modalTitle.textContent = title;
        modalContent.innerHTML = contentHtml;
        onModalSave = onSave;
        modalOverlay.classList.remove('hidden');
    }
    function hideModal() {
        modalOverlay.classList.add('hidden');
        onModalSave = null;
    }
    modalSaveBtn.addEventListener('click', () => {
        if (onModalSave) onModalSave();
    });
    getEl('modal-cancel-btn').addEventListener('click', hideModal);

    // --- Authentication ---
    function handleLogin(e) {
        e.preventDefault();
        const username = getEl('username').value;
        const password = getEl('password').value;
        const foundUser = users.find(u => u.username === username && u.password === password);
        if (foundUser) {
            currentUser = foundUser;
            sessionStorage.setItem('wimoBotCurrentUser', JSON.stringify(currentUser));
            initializeApp();
        } else {
            loginError.textContent = 'Invalid username or password.';
        }
    }
    function checkSession() {
        const storedUser = sessionStorage.getItem('wimoBotCurrentUser');
        if (storedUser) {
            currentUser = JSON.parse(storedUser);
            initializeApp();
        }
    }
    function handleLogout() {
        sessionStorage.removeItem('wimoBotCurrentUser');
        location.reload();
    }
    
    // --- Application Initialization & View Management ---
    function initializeApp() {
        loginOverlay.classList.add('hidden');
        appWrapper.classList.remove('hidden');
        userRoleDisplay.textContent = currentUser.role;
        if (currentUser.role === 'admin') adminTabBtn.classList.remove('hidden');
        
        getEl('logout-button').addEventListener('click', handleLogout);
        templatesTabBtn.addEventListener('click', () => switchView('templates'));
        pnsTabBtn.addEventListener('click', () => switchView('pns'));
        adminTabBtn.addEventListener('click', () => switchView('admin'));
        
        renderCurrentView();
    }

    let currentView = 'templates';
    function switchView(view) {
        currentView = view;
        [templatesTabBtn, pnsTabBtn, adminTabBtn].forEach(btn => btn.classList.remove('active'));
        [templatesView, pnsView, adminView].forEach(v => v.classList.add('hidden'));

        getEl(`${view}-tab-btn`).classList.add('active');
        getEl(`${view}-view`).classList.remove('hidden');
        renderCurrentView();
    }

    function renderCurrentView() {
        if (!currentUser) return;
        switch (currentView) {
            case 'templates': renderTemplatesView(); break;
            case 'pns': renderPNsView(); break;
            case 'admin': renderAdminView(); break;
        }
    }

    // --- TEMPLATES VIEW ---
    function renderTemplatesView() {
        templatesView.innerHTML = `
            <div class="main-content-wrapper">
                <div class="panel container">
                    <div class="left-panel" id="categories-list"></div>
                    <div class="right-panel">
                        <div class="panel-header">
                            <h2 id="templates-header">Templates</h2>
                            <button id="add-template-btn" class="add-btn hidden">+ Add Template</button>
                        </div>
                        <div id="right-panel-content"></div>
                    </div>
                </div>
            </div>`;
        renderCategoriesList();
        renderTemplatesList();
        getEl('add-template-btn').addEventListener('click', handleAddTemplate);
    }

    function renderCategoriesList() {
        const list = getEl('categories-list');
        list.innerHTML = `<div class="panel-header"><h2>Categories</h2><button id="add-category-btn" class="add-btn">+</button></div>`;
        categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = `list-item ${cat._id === activeCategoryId ? 'active' : ''}`;
            item.innerHTML = `<span>${cat.title}</span><div class="list-item-controls"></div>`;
            item.addEventListener('click', () => {
                activeCategoryId = cat._id;
                renderCategoriesList();
                renderTemplatesList();
            });

            if (currentUser.role === 'admin') {
                const controls = item.querySelector('.list-item-controls');
                const editBtn = document.createElement('button');
                editBtn.innerHTML = '&#9998;';
                editBtn.className = 'icon-btn edit';
                editBtn.onclick = (e) => { e.stopPropagation(); handleEditCategory(cat); };
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '&#128465;';
                deleteBtn.className = 'icon-btn delete';
                deleteBtn.onclick = (e) => { e.stopPropagation(); handleDeleteCategory(cat); };
                controls.append(editBtn, deleteBtn);
            }
            list.appendChild(item);
        });
        getEl('add-category-btn').addEventListener('click', handleAddCategory);
    }
    
    function renderTemplatesList() {
        const content = getEl('right-panel-content');
        const addTemplateBtn = getEl('add-template-btn');
        if (!activeCategoryId) {
            content.innerHTML = `<h2>Select a category to view templates.</h2>`;
            addTemplateBtn.classList.add('hidden');
            return;
        }
        addTemplateBtn.classList.remove('hidden');

        const activeCategory = categories.find(c => c._id === activeCategoryId);
        getEl('templates-header').textContent = `${activeCategory.title} Templates`;
        
        if (!activeCategory.templates || activeCategory.templates.length === 0) {
            content.innerHTML = `<h2>No templates in this category.</h2>`;
            return;
        }

        content.innerHTML = '';
        activeCategory.templates.forEach(tpl => {
            const card = document.createElement('div');
            card.className = 'template-card';
            const tagsHtml = tpl.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
            card.innerHTML = `
                <div class="tags-container">${tagsHtml}</div>
                <div class="template-text">${tpl.text}</div>`;
            if (currentUser.role === 'admin') {
                const controls = document.createElement('div');
                controls.className = 'card-controls';
                const editBtn = document.createElement('button');
                editBtn.className = 'icon-btn edit';
                editBtn.innerHTML = '&#9998;';
                editBtn.onclick = () => handleEditTemplate(tpl);
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'icon-btn delete';
                deleteBtn.innerHTML = '&#128465;';
                deleteBtn.onclick = () => handleDeleteTemplate(tpl);
                controls.append(editBtn, deleteBtn);
                card.appendChild(controls);
            }
            card.querySelector('.template-text').addEventListener('click', () => {
                navigator.clipboard.writeText(tpl.text);
                showToast('Text Copied !'); // <-- UPDATED TEXT
            });
            content.appendChild(card);
        });
    }
    
    // --- Templates & Categories CRUD Handlers ---
    function handleAddCategory() {
        showModal('Add New Template Category', `<div class="input-group"><label for="category-title">Category Title</label><input type="text" id="category-title" required></div>`, () => {
            const title = getEl('category-title').value;
            if (title) { sendSocketMessage('create-category', { title }); showToast('Category created!'); hideModal(); }
        });
    }
    function handleEditCategory(category) {
        showModal('Edit Template Category', `<div class="input-group"><label for="category-title">Category Title</label><input type="text" id="category-title" value="${category.title}" required></div>`, () => {
            const title = getEl('category-title').value;
            if (title) { sendSocketMessage('update-category', { categoryId: category._id, title }); showToast('Category updated!'); hideModal(); }
        });
    }
    function handleDeleteCategory(category) {
        if (confirm(`Delete the category "${category.title}"? This will delete all templates inside it.`)) {
            sendSocketMessage('delete-category', { categoryId: category._id }); activeCategoryId = null; showToast('Category deleted!', 'error');
        }
    }
    function handleAddTemplate() {
        showModal('Add New Template', `<div class="input-group"><label for="template-text">Template Text</label><textarea id="template-text" required></textarea></div><div class="input-group"><label for="template-tags">Tags (comma-separated)</label><input type="text" id="template-tags"></div>`, () => {
            const text = getEl('template-text').value;
            const tags = getEl('template-tags').value.split(',').map(t => t.trim()).filter(Boolean);
            if (text) { sendSocketMessage('create-template', { categoryId: activeCategoryId, template: { text, tags } }); showToast('Template added!'); hideModal(); }
        });
    }
    function handleEditTemplate(template) {
        showModal('Edit Template', `<div class="input-group"><label for="template-text">Template Text</label><textarea id="template-text" required>${template.text}</textarea></div><div class="input-group"><label for="template-tags">Tags (comma-separated)</label><input type="text" id="template-tags" value="${template.tags.join(', ')}"></div>`, () => {
            template.text = getEl('template-text').value;
            template.tags = getEl('template-tags').value.split(',').map(t => t.trim()).filter(Boolean);
            sendSocketMessage('update-template', { categoryId: activeCategoryId, template }); showToast('Template updated!'); hideModal();
        });
    }
    function handleDeleteTemplate(template) {
        if (confirm('Delete this template?')) { sendSocketMessage('delete-template', { categoryId: activeCategoryId, templateId: template._id }); showToast('Template deleted!', 'error'); }
    }
    
    // --- PERSONAL NOTES (PNs) VIEW ---
    function renderPNsView() {
        pnsView.innerHTML = `
            <div class="main-content-wrapper">
                <div class="panel container">
                    <div class="left-panel" id="pn-categories-list"></div>
                    <div class="right-panel">
                        <div class="panel-header">
                            <h2 id="pn-header">Personal Notes</h2>
                            <button id="add-pn-note-btn" class="add-btn hidden">+ Add Note</button>
                        </div>
                        <div id="pn-right-panel-content"></div>
                    </div>
                </div>
            </div>`;
        renderPNCategoriesList();
        renderPNNotesList();
        getEl('add-pn-note-btn').addEventListener('click', handleAddPNNote);
    }

    function renderPNCategoriesList() {
        const list = getEl('pn-categories-list');
        list.innerHTML = `<div class="panel-header"><h2>PN Categories</h2><button id="add-pn-category-btn" class="add-btn">+</button></div>`;
        pnCategories.forEach(cat => {
            const item = document.createElement('div');
            item.className = `list-item ${cat._id === activePnCategoryId ? 'active' : ''}`;
            item.innerHTML = `<span>${cat.title}</span><div class="list-item-controls"></div>`;
            item.addEventListener('click', () => { activePnCategoryId = cat._id; renderPNCategoriesList(); renderPNNotesList(); });
            const controls = item.querySelector('.list-item-controls');
            const editBtn = document.createElement('button');
            editBtn.innerHTML = '&#9998;'; editBtn.className = 'icon-btn edit';
            editBtn.onclick = (e) => { e.stopPropagation(); handleEditPNCategory(cat); };
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '&#128465;'; deleteBtn.className = 'icon-btn delete';
            deleteBtn.onclick = (e) => { e.stopPropagation(); handleDeletePNCategory(cat); };
            controls.append(editBtn, deleteBtn);
            list.appendChild(item);
        });
        getEl('add-pn-category-btn').addEventListener('click', handleAddPNCategory);
    }
    
    function renderPNNotesList() {
        const content = getEl('pn-right-panel-content');
        const addNoteBtn = getEl('add-pn-note-btn');
        if (!activePnCategoryId) {
            content.innerHTML = `<h2>Select a category to view your notes.</h2>`; addNoteBtn.classList.add('hidden'); return;
        }
        addNoteBtn.classList.remove('hidden');

        const activeCategory = pnCategories.find(c => c._id === activePnCategoryId);
        getEl('pn-header').textContent = `${activeCategory.title} Notes`;
        if (!activeCategory.notes || activeCategory.notes.length === 0) { content.innerHTML = `<h2>No notes in this category.</h2>`; return; }

        content.innerHTML = '';
        activeCategory.notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'template-card';
            card.innerHTML = `<h4>${note.title}</h4><div class="template-text">${note.content.replace(/\n/g, '<br>')}</div>`;
            const controls = document.createElement('div');
            controls.className = 'card-controls';
            const editBtn = document.createElement('button');
            editBtn.className = 'icon-btn edit'; editBtn.innerHTML = '&#9998;';
            editBtn.onclick = () => handleEditPNNote(note);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'icon-btn delete'; deleteBtn.innerHTML = '&#128465;';
            deleteBtn.onclick = () => handleDeletePNNote(note);
            controls.append(editBtn, deleteBtn);
            card.appendChild(controls);
            card.querySelector('.template-text').addEventListener('click', () => {
                navigator.clipboard.writeText(note.content);
                showToast('Text Copied !'); // <-- UPDATED TEXT
            });
            content.appendChild(card);
        });
    }

    // --- PN CRUD Handlers ---
    function handleAddPNCategory() {
        showModal('Add New Note Category', `<div class="input-group"><label for="pn-cat-title">Category Title</label><input type="text" id="pn-cat-title" required></div>`, () => {
            const title = getEl('pn-cat-title').value;
            if (title) { sendSocketMessage('create-pn-category', { title }); showToast('Note category created!'); hideModal(); }
        });
    }
    function handleEditPNCategory(category) {
        showModal('Edit Note Category', `<div class="input-group"><label for="pn-cat-title">Category Title</label><input type="text" id="pn-cat-title" value="${category.title}" required></div>`, () => {
            const title = getEl('pn-cat-title').value;
            if (title) { sendSocketMessage('update-pn-category', { categoryId: category._id, title }); showToast('Note category updated!'); hideModal(); }
        });
    }
    function handleDeletePNCategory(category) {
        if (confirm(`Delete the category "${category.title}"? This will delete all notes inside it.`)) {
            sendSocketMessage('delete-pn-category', { categoryId: category._id }); activePnCategoryId = null; showToast('Note category deleted!', 'error');
        }
    }
    function handleAddPNNote() {
        showModal('Add New Note', `<div class="input-group"><label for="pn-note-title">Note Title</label><input type="text" id="pn-note-title" required></div><div class="input-group"><label for="pn-note-content">Content</label><textarea id="pn-note-content" required></textarea></div>`, () => {
            const title = getEl('pn-note-title').value;
            const content = getEl('pn-note-content').value;
            if (title && content) { sendSocketMessage('create-pn-note', { categoryId: activePnCategoryId, note: { title, content } }); showToast('Note added!'); hideModal(); }
        });
    }
    function handleEditPNNote(note) {
        showModal('Edit Note', `<div class="input-group"><label for="pn-note-title">Note Title</label><input type="text" id="pn-note-title" value="${note.title}" required></div><div class="input-group"><label for="pn-note-content">Content</label><textarea id="pn-note-content" required>${note.content}</textarea></div>`, () => {
            note.title = getEl('pn-note-title').value;
            note.content = getEl('pn-note-content').value;
            sendSocketMessage('update-pn-note', { categoryId: activePnCategoryId, note }); showToast('Note updated!'); hideModal();
        });
    }
    function handleDeletePNNote(note) {
        if (confirm('Delete this note?')) { sendSocketMessage('delete-pn-note', { categoryId: activePnCategoryId, noteId: note._id }); showToast('Note deleted!', 'error'); }
    }

    // --- ADMIN VIEW ---
    function renderAdminView() {
        adminView.innerHTML = `
            <div class="main-content-wrapper">
                <div class="panel full-width-panel">
                    <div class="panel-header"><h2>User Management</h2><button id="add-user-btn" class="add-btn">+ Add User</button></div>
                    <table class="admin-table">
                        <thead><tr><th>Username</th><th>Role</th><th>Actions</th></tr></thead>
                        <tbody id="users-table-body"></tbody>
                    </table>
                </div>
            </div>`;
        const tableBody = getEl('users-table-body');
        tableBody.innerHTML = '';
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${user.username}</td><td>${user.role}</td><td><button class="icon-btn edit" data-userid="${user._id}">&#9998;</button><button class="icon-btn delete" data-userid="${user._id}" data-username="${user.username}">&#128465;</button></td>`;
            tableBody.appendChild(row);
        });
        getEl('add-user-btn').addEventListener('click', handleAddUser);
        tableBody.querySelectorAll('.edit').forEach(btn => btn.addEventListener('click', (e) => handleEditUser(e.target.dataset.userid)));
        tableBody.querySelectorAll('.delete').forEach(btn => btn.addEventListener('click', (e) => handleDeleteUser(e.target.dataset.userid, e.target.dataset.username)));
    }
    function handleAddUser() {
        showModal('Add New User', `<div class="input-group"><label for="user-username">Username</label><input type="text" id="user-username" required></div><div class="input-group"><label for="user-password">Password</label><input type="password" id="user-password" required></div><div class="input-group"><label for="user-role">Role</label><select id="user-role"><option value="user">User</option><option value="admin">Admin</option></select></div>`,() => {
            const user = { username: getEl('user-username').value, password: getEl('user-password').value, role: getEl('user-role').value };
            if (user.username && user.password) { sendSocketMessage('create-user', { user }); showToast('User created!'); hideModal(); }
        });
    }
    function handleEditUser(userId) {
        const user = users.find(u => u._id === userId);
        showModal('Edit User', `<p><strong>Username:</strong> ${user.username}</p><div class="input-group"><label for="user-role">Role</label><select id="user-role"><option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option></select></div><div class="input-group"><label for="user-password">New Password (optional)</label><input type="password" id="user-password"></div>`,() => {
            const updates = { role: getEl('user-role').value };
            const newPassword = getEl('user-password').value;
            if (newPassword) updates.password = newPassword;
            sendSocketMessage('update-user', { userId, updates }); showToast('User updated!'); hideModal();
        });
    }
    function handleDeleteUser(userId, username) {
        if (userId === currentUser._id) { showToast('You cannot delete yourself.', 'error'); return; }
        if (confirm(`Are you sure you want to delete the user "${username}"?`)) { sendSocketMessage('delete-user', { userId }); showToast('User deleted!', 'error'); }
    }
    
    // --- Initial Load ---
    loginForm.addEventListener('submit', handleLogin);
    connect();
    let firstMessageReceived = false;
    ws.addEventListener('message', () => {
        if (!firstMessageReceived) {
            checkSession();
            firstMessageReceived = true;
        }
    });
});