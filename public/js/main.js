document.addEventListener('DOMContentLoaded', () => {
    // --- WebSocket Connection ---
    const connectWebSocket = () => {
        const ws = new WebSocket(`ws://${window.location.host}`);

        ws.onopen = () => console.log('Connected to WebSocket server');
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'DATA_UPDATE') {
                showToast(`Update received: ${data.payload.message}. Refreshing...`, 'success');
                // A soft refresh is better than a hard reload to maintain user state
                // For this project, a reload is the simplest way to show updates.
                setTimeout(() => window.location.reload(), 2500);
            }
        };

        ws.onclose = () => {
            showToast('Connection lost. Reconnecting in 5 seconds...', 'error');
            setTimeout(connectWebSocket, 5000);
        };
        
        ws.onerror = (err) => {
            console.error('WebSocket Error:', err);
            ws.close();
        };
    };
    connectWebSocket();


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
    const candItems = document.querySelectorAll('.cand-item');
    const tagButtons = document.querySelectorAll('.tag-filter:not(.clear)');
    const clearFiltersBtn = document.getElementById('clearFilters');
    let activeTags = new Set();

    const filterContent = () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        candItems.forEach(item => {
            const text = item.querySelector('.cand-text').textContent.toLowerCase();
            const tags = item.dataset.tags.toLowerCase();
            const textMatch = text.includes(searchTerm) || tags.includes(searchTerm);
            
            const selectedTagsMatch = activeTags.size === 0 || 
                [...activeTags].every(tag => tags.includes(tag));
                
            item.style.display = (textMatch && selectedTagsMatch) ? 'block' : 'none';
        });
    };

    searchInput?.addEventListener('input', filterContent);
    
    tagButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tag = button.dataset.tag;
            button.classList.toggle('active');
            if (activeTags.has(tag)) {
                activeTags.delete(tag);
            } else {
                activeTags.add(tag);
            }
            filterContent();
        });
    });
    
    clearFiltersBtn?.addEventListener('click', () => {
        searchInput.value = '';
        activeTags.clear();
        tagButtons.forEach(b => b.classList.remove('active'));
        filterContent();
    });


    // --- Click to Copy ---
    document.body.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('.copy-btn');
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
                // Sanitize input to prevent malicious code injection
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
    refreshLogsBtn?.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/admin/logs');
            const logs = await response.json();
            const logList = document.getElementById('log-list');
            logList.innerHTML = ''; // Clear existing logs
            if (logs.length === 0) {
                logList.innerHTML = '<p>No error logs found.</p>';
                return;
            }
            logs.forEach(log => {
                const logItem = document.createElement('div');
                logItem.className = 'log-item';
                logItem.innerHTML = `
                    <p><strong>[${new Date(log.createdAt).toLocaleString()}] ${log.level.toUpperCase()}</strong></p>
                    <p>${log.message}</p>
                    <pre>${log.stack}</pre>
                `;
                logList.appendChild(logItem);
            });
        } catch(error) {
            showToast('Failed to fetch logs.', 'error');
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
    
    // Remove the toast after a few seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}