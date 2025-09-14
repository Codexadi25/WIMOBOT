document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // --- WebSocket Connection ---
    // =========================================================================

    // improved ws/wss selection and avoid repeated toasts when reconnection is expected
    let wsReconnectTimer = null;
    const connectWebSocket = () => {
        // choose correct protocol depending on page protocol
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${proto}//${window.location.host}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Connected to WebSocket server');
            if (wsReconnectTimer) {
                clearTimeout(wsReconnectTimer);
                wsReconnectTimer = null;
            }
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'DATA_UPDATE') {
                    showToast(`Live update received. Refreshing...`, 'success');
                    setTimeout(() => window.location.reload(), 1500);
                }
            } catch (err) {
                console.error('WS message parse error', err);
            }
        };

        ws.onclose = () => {
            // only show one toast per reconnect attempt
            if (!wsReconnectTimer) {
                showToast('Connection lost. Reconnecting in 5 seconds...', 'error');
            }
            wsReconnectTimer = setTimeout(() => {
                wsReconnectTimer = null;
                connectWebSocket();
            }, 5000);
        };

        ws.onerror = (err) => {
            console.error('WebSocket error', err);
            // let onclose handle reconnection and toast
        };
    };
    connectWebSocket();

    // =========================================================================
    // --- API Helper Function (ensure cookies are sent with fetch) ---
    // =========================================================================
    const apiRequest = async (url, method = 'GET', body = null) => {
        try {
            const options = { method, headers: {}, credentials: 'same-origin' }; // include session cookie
            if (body instanceof FormData) {
                options.body = body;
            } else if (body) {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(body);
            }
            const response = await fetch(url, options);
            if (!response.ok) {
                let errorData = {};
                try { errorData = await response.json(); } catch (e) {}
                throw new Error(errorData.message || `API error ${response.status}`);
            }
            return method !== 'DELETE' ? response.json() : null;
        } catch (error) {
            showToast(error.message || 'Network error', 'error');
            throw error;
        }
    };

    // --- Category Navigation Filter ---
    document.body.addEventListener('click', (e) => {
        if (e.target.matches('.category-nav-btn')) {
            const selectedCategoryId = e.target.dataset.categoryId;
            document.querySelectorAll('.category-nav-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            document.querySelectorAll('#cands-list-container .cand-item').forEach(item => {
                if (selectedCategoryId === 'all' || item.dataset.categoryId === selectedCategoryId) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });

        }
    });

    // --- Tab Switching ---
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.dataset.tab;
            tabLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            link.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // --- Search and Filter Logic ---
    const searchInput = document.getElementById('searchInput');
    let activeTags = new Set();

    const filterContent = () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const currentTab = document.querySelector('.tab-content.active');
        const hasActiveSearch = searchTerm.length > 0 || activeTags.size > 0;
        
        if (currentTab.id === 'Cands') {
            const candsContainer = document.getElementById('cands-list-container');
            const categoryGroups = document.querySelectorAll('#cands-list-container .category-group');
            const candItems = document.querySelectorAll('#cands-list-container .cand-item');
            
            // Add/remove search mode class
            if (hasActiveSearch) {
                candsContainer.classList.add('search-mode');
            } else {
                candsContainer.classList.remove('search-mode');
            }
            
            // Show/hide category headers based on search state
            categoryGroups.forEach(group => {
                const categoryHeader = group.querySelector('.category-header');
                if (categoryHeader) {
                    categoryHeader.style.display = hasActiveSearch ? 'none' : 'flex';
                }
            });
            
            // Filter cand items
            candItems.forEach(item => {
                const text = item.querySelector('.cand-text').textContent.toLowerCase();
                const tags = item.dataset.tags.toLowerCase();
                const textMatch = text.includes(searchTerm) || tags.includes(searchTerm);
                const selectedTagsMatch = activeTags.size === 0 || 
                    [...activeTags].every(tag => tags.includes(tag));
                item.style.display = (textMatch && selectedTagsMatch) ? 'block' : 'none';
            });
            
            // Show search results count
            const visibleItems = Array.from(candItems).filter(item => item.style.display !== 'none');
            const searchIndicator = document.getElementById('search-indicator');
            if (searchIndicator) {
                if (hasActiveSearch) {
                    searchIndicator.textContent = `Found ${visibleItems.length} result${visibleItems.length !== 1 ? 's' : ''}`;
                    searchIndicator.classList.add('active');
                } else {
                    searchIndicator.classList.remove('active');
                }
            }
        } else if (currentTab.id === 'PNs') {
            const pnItems = document.querySelectorAll('#pns-list-container .pn-item');
            pnItems.forEach(item => {
                const title = item.querySelector('.pn-title').textContent.toLowerCase();
                const content = item.querySelector('.pn-content').textContent.toLowerCase();
                const category = item.dataset.pnCategoryTitle.toLowerCase();
                const textMatch = title.includes(searchTerm) || content.includes(searchTerm) || category.includes(searchTerm);
                item.style.display = textMatch ? 'block' : 'none';
            });
        }
    };

    searchInput?.addEventListener('input', filterContent);
    
    // Initialize display state on page load
    filterContent();
    
    // Tag filter buttons for Cands
    document.addEventListener('click', (e) => {
        if (e.target.matches('.tag-filter:not(.clear)')) {
            const tag = e.target.dataset.tag;
            e.target.classList.toggle('active');
            if (activeTags.has(tag)) {
                activeTags.delete(tag);
            } else {
                activeTags.add(tag);
            }
            filterContent();
        }
    });

    // Clear filters button
    document.addEventListener('click', (e) => {
        if (e.target.matches('#clearFilters') || e.target.matches('#clearFiltersPN') || e.target.matches('.clear-filters-btn')) {
            searchInput.value = '';
            activeTags.clear();
            document.querySelectorAll('.tag-filter').forEach(b => b.classList.remove('active'));
            filterContent();
        }
    });

    // --- Modal Handling ---
    const modal = document.getElementById('form-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalForm = document.getElementById('modal-form');
    const modalCloseBtn = document.querySelector('.modal-close-btn');
    const openModal = () => modal.style.display = 'flex';
    const closeModal = () => modal.style.display = 'none';
    modalCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // --- Main Event Listener (Event Delegation) ---
    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        const closest = (sel) => target.closest(sel);
        
        // --- Tab Switching (use closest so clicking on children still works) ---
        const tabLink = target.closest('.tab-link');
        if (tabLink) {
            document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tabLink.classList.add('active');
            const tabId = tabLink.dataset.tab;
            if (tabId) {
                const tabEl = document.getElementById(tabId);
                if (tabEl) tabEl.classList.add('active');
            }
            return;
        }

        // --- Category CRUD ---
        if (e.target.matches('#btn-create-category')) {
            showCategoryForm({});
        }
        if (e.target.matches('.btn-edit-category')) {
            const categoryDiv = e.target.closest('.category-group');
            const categoryId = categoryDiv.dataset.categoryId;
            const title = categoryDiv.querySelector('.category-title').dataset.categoryTitle;
            showCategoryForm({ categoryId, title });
        }
        if (e.target.matches('.btn-delete-category')) {
            if (!confirm('Are you sure you want to delete this ENTIRE category and all of its responses?')) return;
            const categoryDiv = e.target.closest('.category-group');
            const categoryId = categoryDiv.dataset.categoryId;
            await apiRequest(`/api/cands/category/${categoryId}`, 'DELETE');
            categoryDiv.remove();
            showToast('Category deleted successfully.');
        }

        // --- Cands CRUD ---
        if (e.target.matches('.btn-add-cand')) {
            const categoryDiv = e.target.closest('.category-group');
            const categoryId = categoryDiv.dataset.categoryId;
            showCandForm({ categoryId });
        }
        if (e.target.matches('.btn-edit-cand')) {
            const candItem = e.target.closest('.cand-item');
            const categoryDiv = e.target.closest('.category-group');
            const templateId = candItem.dataset.templateId;
            const categoryId = categoryDiv.dataset.categoryId;
            const text = candItem.querySelector('.cand-text').textContent;
            const tags = candItem.dataset.tags.split(' ').join(', ');
            showCandForm({ categoryId, templateId, text, tags });
        }
        if (e.target.matches('.btn-delete-cand')) {
             if (!confirm('Are you sure you want to delete this canned response?')) return;
             const candItem = e.target.closest('.cand-item');
             const categoryDiv = e.target.closest('.category-group');
             const templateId = candItem.dataset.templateId;
             const categoryId = categoryDiv.dataset.categoryId;
             await apiRequest(`/api/cands/template/${categoryId}/${templateId}`, 'DELETE');
             candItem.remove();
             showToast('Canned response deleted successfully.');
        }

        // --- Private Notes CRUD ---
        if (e.target.matches('#btn-create-pn')) {
            showPNForm({});
        }
        if (e.target.matches('.btn-edit-pn')) {
            const pnItem = e.target.closest('.pn-item');
            const noteId = pnItem.dataset.noteId;
            const title = pnItem.querySelector('.pn-title').textContent;
            const content = pnItem.querySelector('.pn-content').textContent;
            const category = pnItem.dataset.pnCategoryTitle;
            showPNForm({ noteId, title, content, category });
        }
        if (e.target.matches('.btn-delete-pn')) {
            if (!confirm('Are you sure you want to delete this private note?')) return;
            const pnItem = e.target.closest('.pn-item');
            const noteId = pnItem.dataset.noteId;
            await apiRequest(`/api/pns/${noteId}`, 'DELETE');
            pnItem.remove();
            showToast('Private note deleted successfully.');
        }

        // --- PN Category Navigation ---
        if (e.target.matches('.pn-category-nav-btn')) {
            const selectedCategory = e.target.dataset.pnCategory;
            document.querySelectorAll('.pn-category-nav-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            document.querySelectorAll('#pns-list-container .pn-item').forEach(item => {
                if (selectedCategory === 'all' || item.dataset.pnCategoryTitle === selectedCategory) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        }
    });

    // --- Category Form Logic ---
    const showCategoryForm = ({ categoryId = null, title = '' }) => {
        const isEditing = categoryId !== null;
        modalTitle.textContent = isEditing ? 'Edit Category' : 'Create New Category';
        modalForm.innerHTML = `
            <label for="categoryTitle">Category Title</label>
            <input type="text" id="categoryTitle" name="title" value="${title}" required>
            <button type="submit" class="action-btn">${isEditing ? 'Save Changes' : 'Create Category'}</button>
        `;
        openModal();

        modalForm.onsubmit = async (e) => {
            e.preventDefault();
            const newTitle = document.getElementById('categoryTitle').value;
            try {
                if (isEditing) {
                    await apiRequest(`/api/cands/category/${categoryId}`, 'PUT', { title: newTitle });
                    const titleElement = document.querySelector(`.category-group[data-category-id="${categoryId}"] .category-title`);
                    titleElement.textContent = newTitle;
                    titleElement.dataset.categoryTitle = newTitle;
                    showToast('Category updated!');
                } else {
                    await apiRequest('/api/cands/category', 'POST', { title: newTitle });
                    showToast('Category created! Page will refresh to show it.');
                    window.location.reload(); 
                }
                closeModal();
            } catch (error) {
                console.error('Failed to save category:', error);
            }
        };
    };

    // --- Cand Form Logic ---
    const showCandForm = ({ categoryId, templateId = null, text = '', tags = '' }) => {
        const isEditing = templateId !== null;
        modalTitle.textContent = isEditing ? 'Edit Canned Response' : 'Add Canned Response';
        modalForm.innerHTML = `
            <label for="candText">Response Text</label>
            <textarea id="candText" name="text" required>${text}</textarea>
            <label for="candTags">Tags (comma-separated)</label>
            <input type="text" id="candTags" name="tags" value="${tags}" placeholder="e.g., delay, dp_issue">
            <button type="submit" class="action-btn">${isEditing ? 'Save Changes' : 'Create Cand'}</button>
        `;
        openModal();

        modalForm.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(modalForm);
            const body = {
                text: formData.get('text'),
                tags: formData.get('tags').split(',').map(tag => tag.trim()).filter(Boolean),
            };

            try {
                if (isEditing) {
                    await apiRequest(`/api/cands/template/${categoryId}/${templateId}`, 'PUT', body);
                    showToast('Canned response updated!');
                } else {
                    await apiRequest(`/api/cands/template/${categoryId}`, 'POST', body);
                    showToast('Canned response created!');
                }
                closeModal();
                window.location.reload(); 
            } catch (error) {
                console.error('Failed to save cand:', error);
            }
        };
    };

    // --- Private Notes Form Logic ---
    const showPNForm = ({ noteId = null, title = '', content = '', category = '' }) => {
        const isEditing = noteId !== null;
        modalTitle.textContent = isEditing ? 'Edit Private Note' : 'Add Private Note';
        modalForm.innerHTML = `
            <label for="pnTitle">Note Title</label>
            <input type="text" id="pnTitle" name="title" value="${title}" required>
            <label for="pnContent">Note Content</label>
            <textarea id="pnContent" name="content" required>${content}</textarea>
            <label for="pnCategory">Category</label>
            <input type="text" id="pnCategory" name="category" value="${category}" placeholder="e.g., Personal, Work, Ideas">
            <button type="submit" class="action-btn">${isEditing ? 'Save Changes' : 'Create Note'}</button>
        `;
        openModal();

        modalForm.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(modalForm);
            const body = {
                title: formData.get('title'),
                content: formData.get('content'),
                category: formData.get('category'),
            };

            try {
                if (isEditing) {
                    await apiRequest(`/api/pns/${noteId}`, 'PUT', body);
                    showToast('Private note updated!');
                } else {
                    await apiRequest('/api/pns', 'POST', body);
                    showToast('Private note created!');
                }
                closeModal();
                window.location.reload(); 
            } catch (error) {
                console.error('Failed to save private note:', error);
            }
        };
    };

    // --- Admin Panel & Logger (making existing functionality work) ---

/* -----------------------------
   Admin: User Management UI
   Requires: element with id "admin-users-container"
   ----------------------------- */
async function fetchAndRenderAdminUsers() {
    const container = document.getElementById('admin-users-container');
    if (!container) return;
    try {
        const res = await fetch('/api/admin/users');
        if (!res.ok) throw new Error('Failed to load users');
        const users = await res.json();

        // build table
        const rows = users.map(u => {
            return `
            <tr data-user-id="${u._id}">
                <td>${u.username}</td>
                <td>
                    <select class="user-role-select" data-user-id="${u._id}">
                        <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
                        <option value="editor" ${u.role === 'editor' ? 'selected' : ''}>editor</option>
                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
                    </select>
                </td>
                <td>
                    <button class="btn btn-sm btn-reset-password" data-user-id="${u._id}">Reset Password</button>
                    <button class="btn btn-sm btn-set-password" data-user-id="${u._id}">Set Password</button>
                    <button class="btn btn-sm btn-delete-user" data-user-id="${u._id}">Delete</button>
                </td>
            </tr>`;
        }).join('');

        container.innerHTML = `
            <table class="admin-table" style="width:100%">
                <thead><tr><th>Username</th><th>Role</th><th>Actions</th></tr></thead>
                <tbody id="admin-users-table-body">${rows}</tbody>
            </table>
        `;
    } catch (err) {
        console.error(err);
        showToast('Unable to load users', 'error');
    }
}

// Listen for actions (delegated)
document.addEventListener('click', async (e) => {
    const target = e.target;
    // Role change handled on 'change' event below (delegated)
    if (target.matches('.btn-reset-password')) {
        const userId = target.dataset.userId;
        if (!userId) return;
        if (!confirm('Reset password for this user? A temporary password will be generated.')) return;
        try {
            const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Reset failed');
            // show temporary password in modal so admin can copy it
            if (modal && modalForm && modalTitle) {
                modalTitle.textContent = `Temporary password for ${userId}`;
                modalForm.innerHTML = `
                    <p class="small">Temporary password (copy it now, it will not be shown again):</p>
                    <pre id="temp-pass" style="padding:10px;background:#f6f8fa;border-radius:6px;">${data.tempPassword}</pre>
                    <button id="copy-temp-pass" class="action-btn">Copy Temporary Password</button>
                `;
                openModal();
                document.getElementById('copy-temp-pass')?.addEventListener('click', () => {
                    const text = document.getElementById('temp-pass')?.textContent || '';
                    navigator.clipboard.writeText(text).then(() => showToast('Password copied!'));
                });
            } else {
                showToast(`Temp password: ${data.tempPassword}`, 'success');
            }
            await fetchAndRenderAdminUsers();
        } catch (err) {
            showToast(err.message || 'Reset failed', 'error');
        }
        return;
    }

    if (target.matches('.btn-set-password')) {
        const userId = target.dataset.userId;
        if (!userId) return;
        // open modal with form
        if (!modal || !modalForm || !modalTitle) return;
        modalTitle.textContent = 'Set New Password';
        modalForm.innerHTML = `
            <label for="adminNewPassword">New Password</label>
            <input id="adminNewPassword" type="password" required placeholder="Enter new password (min 6 chars)">
            <button type="submit" id="adminSetPasswordSubmit" class="action-btn">Set Password</button>
        `;
        openModal();
        modalForm.onsubmit = async (ev) => {
            ev.preventDefault();
            const newPassword = document.getElementById('adminNewPassword')?.value || '';
            if (newPassword.length < 6) return showToast('Password must be at least 6 characters', 'error');
            try {
                const res = await fetch(`/api/admin/users/${userId}/password`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newPassword })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to set password');
                showToast('Password updated', 'success');
                closeModal();
            } catch (err) {
                showToast(err.message || 'Failed to set password', 'error');
            }
        };
        return;
    }

    if (target.matches('.btn-delete-user')) {
        const userId = target.dataset.userId;
        if (!userId) return;
        if (!confirm('Delete this user? This action cannot be undone.')) return;
        try {
            const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Delete failed');
            showToast('User deleted', 'success');
            await fetchAndRenderAdminUsers();
        } catch (err) {
            showToast(err.message || 'Delete failed', 'error');
        }
        return;
    }
});

// delegated change for role selects
document.addEventListener('change', async (e) => {
    const target = e.target;
    if (target.matches('.user-role-select')) {
        const userId = target.dataset.userId;
        const role = target.value;
        try {
            const res = await fetch(`/api/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Role update failed');
            showToast('Role updated', 'success');
            await fetchAndRenderAdminUsers();
        } catch (err) {
            showToast(err.message || 'Role update failed', 'error');
        }
    }
});

    // --- Toast Notification Function (same as before) ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

    // --- Click to Copy ---
    document.body.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('.copy-btn');
        const candItem = e.target.closest('.cand-item');
        if (e.target.closest('.icon-btn')) {
            return;
        }
        if (candItem) {
            const textToCopy = candItem.querySelector('.cand-text').textContent;
            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast('Copied to clipboard!');
            });
        }
        if (copyBtn) {
            const textToCopy = copyBtn.closest('.cand-item').querySelector('.cand-text').textContent;
            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast('Copied to clipboard!');
            }).catch(err => {
                showToast('Failed to copy!', 'error');
            });
        }
    });

    // --- Calculators ---
    const percAmount = document.getElementById('percAmount');
    const percValue = document.getElementById('percValue');
    const percResult = document.getElementById('percResult');
    const exprInput = document.getElementById('exprInput');
    const exprResult = document.getElementById('exprResult');

    const calculatePercentage = () => {
        const amount = parseFloat(percAmount.value);
        const percent = parseFloat(percValue.value);
        if (!isNaN(amount) && !isNaN(percent)) {
            percResult.textContent = `Result: ${(amount * (percent / 100)).toFixed(2)}`;
        } else {
            percResult.textContent = 'Result: 0.00';
        }
    };
    percAmount?.addEventListener('input', calculatePercentage);
    percValue?.addEventListener('input', calculatePercentage);

    exprInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            try {
                const sanitizedExpression = exprInput.value.replace(/[^-()\d/*+.]/g, '');
                const result = new Function('return ' + sanitizedExpression)();
                exprResult.textContent = `Result: ${result}`;
            } catch (error) {
                exprResult.textContent = 'Invalid expression';
            }
        }
    });

    // --- Admin Panel Logic ---
    // Bulk Cand Upload
    const bulkUploadForm = document.getElementById('bulk-upload-form');
    bulkUploadForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(bulkUploadForm);
        try {
            const response = await fetch('/api/admin/bulk-upload-cands', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            showToast('Cands uploaded successfully! Page will refresh.', 'success');
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        }
    });
    
    // Bulk User Creation
    const bulkUserForm = document.getElementById('bulk-user-form');
    bulkUserForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernames = document.getElementById('bulk-usernames').value.split('\n').filter(u => u.trim() !== '');
        try {
            const response = await fetch('/api/users/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernames })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            
            const resultsBox = document.getElementById('bulk-user-results');
            const credsOutput = document.getElementById('new-creds-output');
            
            let output = 'New User Credentials:\n\n';
            result.createdUsers.forEach(u => {
                output += `Username: ${u.username}\nPassword: ${u.password}\n\n`;
            });
            
            credsOutput.textContent = output;
            resultsBox.style.display = 'block';
            showToast('Users created!', 'success');
        } catch (error) {
             showToast(`Error: ${error.message}`, 'error');
        }
    });
    
    // Copy new user credentials
    const copyCredsBtn = document.getElementById('copy-creds-btn');
    copyCredsBtn?.addEventListener('click', () => {
        const text = document.getElementById('new-creds-output').textContent;
        navigator.clipboard.writeText(text).then(() => showToast('Credentials copied!'));
    });
    
    // --- Logger Panel Logic ---
    const refreshLogsBtn = document.getElementById('refreshLogsBtn');
    const logLevelFilter = document.getElementById('logLevelFilter');
    let allLogs = [];

    const renderLogs = (logs) => {
        const logList = document.getElementById('log-list');
        logList.innerHTML = '';
        
        if (logs.length === 0) {
            logList.innerHTML = '<p>No logs found for the selected filter.</p>';
            return;
        }

        logs.forEach(log => {
            const logItem = document.createElement('div');
            logItem.className = `log-item log-${log.level}`;
            
            const severityClass = log.severity ? `severity-${log.severity}` : '';
            const hasDetails = log.description || log.stack || log.oldData || log.newData;
            
            logItem.innerHTML = `
                <div class="log-header">
                    <div class="log-meta">
                        <span class="log-level ${log.level}">${log.level.toUpperCase()}</span>
                        <span class="log-severity ${severityClass}">${log.severity || 'medium'}</span>
                        <span class="log-time">${new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <div class="log-actions">
                        ${hasDetails ? '<button class="log-toggle-details" onclick="toggleLogDetails(this)">Show Details</button>' : ''}
                    </div>
                </div>
                <div class="log-content">
                    <p class="log-message">${log.message}</p>
                    ${log.username ? `<p class="log-user"><strong>User:</strong> ${log.username}</p>` : ''}
                    ${log.action ? `<p class="log-action"><strong>Action:</strong> ${log.action}</p>` : ''}
                    ${log.resource ? `<p class="log-resource"><strong>Resource:</strong> ${log.resource}</p>` : ''}
                    ${log.responseTime ? `<p class="log-response-time"><strong>Response Time:</strong> ${log.responseTime}ms</p>` : ''}
                    ${log.statusCode ? `<p class="log-status"><strong>Status:</strong> ${log.statusCode}</p>` : ''}
                </div>
                ${hasDetails ? `
                    <div class="log-details" style="display: none;">
                        ${log.description ? `<div class="log-description"><strong>Description:</strong><br>${log.description}</div>` : ''}
                        ${log.stack ? `<div class="log-stack"><strong>Stack Trace:</strong><br><pre>${log.stack}</pre></div>` : ''}
                        ${log.oldData ? `<div class="log-old-data"><strong>Previous Data:</strong><br><pre>${JSON.stringify(log.oldData, null, 2)}</pre></div>` : ''}
                        ${log.newData ? `<div class="log-new-data"><strong>New Data:</strong><br><pre>${JSON.stringify(log.newData, null, 2)}</pre></div>` : ''}
                        ${log.ip ? `<div class="log-ip"><strong>IP:</strong> ${log.ip}</div>` : ''}
                        ${log.userAgent ? `<div class="log-user-agent"><strong>User Agent:</strong> ${log.userAgent}</div>` : ''}
                    </div>
                ` : ''}
            `;
            logList.appendChild(logItem);
        });
    };

    refreshLogsBtn?.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/admin/logs');
            allLogs = await response.json();
            renderLogs(allLogs);
        } catch(error) {
            showToast('Failed to fetch logs.', 'error');
        }
    });

    logLevelFilter?.addEventListener('change', () => {
        const selectedLevel = logLevelFilter.value;
        if (selectedLevel === 'all') {
            renderLogs(allLogs);
        } else {
            const filteredLogs = allLogs.filter(log => log.level === selectedLevel);
            renderLogs(filteredLogs);
        }
    });

    // Global function for toggling log details
    window.toggleLogDetails = function(button) {
        const details = button.closest('.log-item').querySelector('.log-details');
        const isVisible = details.style.display !== 'none';
        details.style.display = isVisible ? 'none' : 'block';
        button.textContent = isVisible ? 'Show Details' : 'Hide Details';
    };

    // --- User Management Logic ---
    const refreshUsersBtn = document.getElementById('refreshUsersBtn');
    const cleanupLogsBtn = document.getElementById('cleanupLogsBtn');
    let allUsers = [];

    const renderUsers = (users) => {
        const userList = document.getElementById('user-management-list');
        userList.innerHTML = '';
        
        if (users.length === 0) {
            userList.innerHTML = '<p>No users found.</p>';
            return;
        }

        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.innerHTML = `
                <div class="user-info">
                    <div class="user-details">
                        <h4>${user.username}</h4>
                        <span class="user-role role-${user.role}">${user.role.toUpperCase()}</span>
                        <span class="user-created">Created: ${new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div class="user-actions">
                        <select class="role-select" data-user-id="${user._id}" data-current-role="${user.role}">
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Editor</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                        <button class="btn-delete-user action-btn-sm" data-user-id="${user._id}" data-username="${user.username}">Delete</button>
                    </div>
                </div>
            `;
            userList.appendChild(userItem);
        });
    };

    refreshUsersBtn?.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/admin/users');
            allUsers = await response.json();
            renderUsers(allUsers);
        } catch(error) {
            showToast('Failed to fetch users.', 'error');
        }
    });

    cleanupLogsBtn?.addEventListener('click', async () => {
        if (!confirm('This will delete logs older than 30 days and keep only the latest 100 logs. Continue?')) return;
        
        try {
            const response = await fetch('/api/admin/cleanup-logs', { method: 'POST' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            showToast(`Log cleanup completed. ${result.deletedOldLogs} old logs deleted.`, 'success');
        } catch(error) {
            showToast(`Error: ${error.message}`, 'error');
        }
    });

    // Handle role changes
    document.addEventListener('change', async (e) => {
        if (e.target.matches('.role-select')) {
            const userId = e.target.dataset.userId;
            const newRole = e.target.value;
            const currentRole = e.target.dataset.currentRole;
            
            if (newRole === currentRole) return;
            
            try {
                const response = await fetch(`/api/admin/users/${userId}/role`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role: newRole })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message);
                }
                
                e.target.dataset.currentRole = newRole;
                showToast(`User role updated to ${newRole}`, 'success');
            } catch(error) {
                showToast(`Error: ${error.message}`, 'error');
                e.target.value = currentRole; // Revert selection
            }
        }
    });

    // Handle user deletion
    document.addEventListener('click', async (e) => {
        if (e.target.matches('.btn-delete-user')) {
            const userId = e.target.dataset.userId;
            const username = e.target.dataset.username;
            
            if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) return;
            
            try {
                const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message);
                }
                
                showToast(`User "${username}" deleted successfully`, 'success');
                // Refresh user list
                refreshUsersBtn.click();
            } catch(error) {
                showToast(`Error: ${error.message}`, 'error');
            }
        }
    });

});

// --- Toast Notification Function ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}
