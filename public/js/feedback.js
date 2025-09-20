// Feedback Panel JavaScript
document.addEventListener('DOMContentLoaded', () => {
    const feedbackListContainer = document.getElementById('feedback-list-container');
    const feedbackModal = document.getElementById('feedback-modal');
    const feedbackForm = document.getElementById('feedback-form');
    const submitFeedbackBtn = document.getElementById('btn-submit-feedback');
    const closeFeedbackModal = document.getElementById('close-feedback-modal');
    const cancelFeedbackBtn = document.getElementById('cancel-feedback');
    
    // Filter elements
    const typeFilter = document.getElementById('feedback-type-filter');
    const statusFilter = document.getElementById('feedback-status-filter');
    const priorityFilter = document.getElementById('feedback-priority-filter');
    const clearFiltersBtn = document.getElementById('clear-feedback-filters');
    
    let allFeedback = [];
    let currentFilters = {};
    
    // Initialize
    loadFeedback();
    setupEventListeners();
    
    function setupEventListeners() {
        // Modal controls
        submitFeedbackBtn?.addEventListener('click', openFeedbackModal);
        closeFeedbackModal?.addEventListener('click', closeModal);
        cancelFeedbackBtn?.addEventListener('click', closeModal);
        feedbackModal?.addEventListener('click', (e) => {
            if (e.target === feedbackModal) closeModal();
        });
        
        // Form submission
        feedbackForm?.addEventListener('submit', handleFeedbackSubmit);
        
        // Filters
        typeFilter?.addEventListener('change', applyFilters);
        statusFilter?.addEventListener('change', applyFilters);
        priorityFilter?.addEventListener('change', applyFilters);
        clearFiltersBtn?.addEventListener('click', clearFilters);
    }
    
    async function loadFeedback() {
        try {
            showLoading();
            const response = await fetch('/api/feedback/');
            if (!response.ok) throw new Error('Failed to load feedback');
            
            const data = await response.json();
            allFeedback = data.feedback || data; // Handle both paginated and non-paginated responses
            renderFeedback(allFeedback);
        } catch (error) {
            showError('Failed to load feedback: ' + error.message);
        }
    }
    
    function renderFeedback(feedback) {
        if (!feedbackListContainer) return;
        
        if (feedback.length === 0) {
            feedbackListContainer.innerHTML = '<div class="no-feedback">No feedback found. Submit your first feedback!</div>';
            return;
        }
        
        feedbackListContainer.innerHTML = feedback.map(item => `
            <div class="feedback-item" data-id="${item._id}">
                <div class="feedback-header">
                    <div class="feedback-meta">
                        <span class="feedback-type ${item.type}">${item.type.replace('_', ' ')}</span>
                        <span class="feedback-priority ${item.priority}">${item.priority}</span>
                        <span class="feedback-status ${item.status}">${item.status.replace('_', ' ')}</span>
                    </div>
                    <div class="feedback-date">${new Date(item.createdAt).toLocaleDateString()}</div>
                </div>
                <div class="feedback-title">${escapeHtml(item.title)}</div>
                <div class="feedback-description">${escapeHtml(item.description)}</div>
                ${item.tags && item.tags.length > 0 ? `
                    <div class="feedback-tags">
                        ${item.tags.map(tag => `<span class="feedback-tag">${escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}
                ${item.adminResponse ? `
                    <div class="admin-response">
                        <div class="admin-response-header">Admin Response:</div>
                        <div class="admin-response-content">${escapeHtml(item.adminResponse)}</div>
                    </div>
                ` : ''}
                <div class="feedback-actions">
                    <div class="feedback-votes">
                        ${item.isPublic ? `
                            <button class="vote-btn" data-id="${item._id}" data-vote="upvote">
                                👍 ${item.upvotes?.length || 0}
                            </button>
                            <button class="vote-btn" data-id="${item._id}" data-vote="downvote">
                                👎 ${item.downvotes?.length || 0}
                            </button>
                        ` : ''}
                    </div>
                    <div class="feedback-author">By ${escapeHtml(item.username)}</div>
                </div>
                ${window.currentUserRole === 'admin' || window.currentUserRole === 'editor' ? `
                    <div class="admin-controls">
                        <select class="status-select" data-id="${item._id}">
                            <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="in_progress" ${item.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                            <option value="resolved" ${item.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                            <option value="rejected" ${item.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                        </select>
                        <textarea class="admin-response-input" data-id="${item._id}" placeholder="Add admin response...">${item.adminResponse || ''}</textarea>
                        <button class="update-feedback-btn" data-id="${item._id}">Update</button>
                    </div>
                ` : ''}
            </div>
        `).join('');
        
        // Add vote event listeners
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', handleVote);
        });
        
        // Add admin control event listeners
        document.querySelectorAll('.update-feedback-btn').forEach(btn => {
            btn.addEventListener('click', handleFeedbackUpdate);
        });
    }
    
    function openFeedbackModal() {
        if (feedbackModal) {
            feedbackModal.style.display = 'flex';
            document.body.classList.add('modal-open');
        }
    }
    
    function closeModal() {
        if (feedbackModal) {
            feedbackModal.style.display = 'none';
            document.body.classList.remove('modal-open');
            feedbackForm?.reset();
        }
    }
    
    async function handleFeedbackSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(feedbackForm);
        const data = {
            type: formData.get('type'),
            title: formData.get('title'),
            description: formData.get('description'),
            priority: formData.get('priority'),
            tags: formData.get('tags') ? formData.get('tags').split(',').map(t => t.trim()).filter(Boolean) : [],
            isPublic: formData.get('isPublic') === 'on'
        };
        
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message);
            }
            
            showToast('Feedback submitted successfully!', 'success');
            closeModal();
            loadFeedback();
        } catch (error) {
            showToast('Error submitting feedback: ' + error.message, 'error');
        }
    }
    
    async function handleVote(e) {
        const feedbackId = e.target.dataset.id;
        const voteType = e.target.dataset.vote;
        
        try {
            const response = await fetch(`/api/feedback/${feedbackId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voteType })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message);
            }
            
            const result = await response.json();
            // Update the specific feedback item in allFeedback array
            const feedbackIndex = allFeedback.findIndex(f => f._id === feedbackId);
            if (feedbackIndex !== -1) {
                allFeedback[feedbackIndex] = result.feedback;
            }
            renderFeedback(allFeedback);
            showToast('Vote recorded!', 'success');
        } catch (error) {
            showToast('Error voting: ' + error.message, 'error');
        }
    }
    
    async function handleFeedbackUpdate(e) {
        const feedbackId = e.target.dataset.id;
        const statusSelect = document.querySelector(`.status-select[data-id="${feedbackId}"]`);
        const adminResponseInput = document.querySelector(`.admin-response-input[data-id="${feedbackId}"]`);
        
        const status = statusSelect.value;
        const adminResponse = adminResponseInput.value;
        
        try {
            const response = await fetch(`/api/feedback/${feedbackId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, adminResponse })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message);
            }
            
            const result = await response.json();
            // Update the specific feedback item in allFeedback array
            const feedbackIndex = allFeedback.findIndex(f => f._id === feedbackId);
            if (feedbackIndex !== -1) {
                allFeedback[feedbackIndex] = result.feedback;
            }
            renderFeedback(allFeedback);
            showToast('Feedback updated successfully!', 'success');
        } catch (error) {
            showToast('Error updating feedback: ' + error.message, 'error');
        }
    }
    
    function applyFilters() {
        currentFilters = {
            type: typeFilter?.value || '',
            status: statusFilter?.value || '',
            priority: priorityFilter?.value || ''
        };
        
        const filtered = allFeedback.filter(item => {
            return (!currentFilters.type || item.type === currentFilters.type) &&
                   (!currentFilters.status || item.status === currentFilters.status) &&
                   (!currentFilters.priority || item.priority === currentFilters.priority);
        });
        
        renderFeedback(filtered);
    }
    
    function clearFilters() {
        if (typeFilter) typeFilter.value = '';
        if (statusFilter) statusFilter.value = '';
        if (priorityFilter) priorityFilter.value = '';
        currentFilters = {};
        renderFeedback(allFeedback);
    }
    
    function showLoading() {
        if (feedbackListContainer) {
            feedbackListContainer.innerHTML = '<div class="loading-indicator">Loading feedback...</div>';
        }
    }
    
    function showError(message) {
        if (feedbackListContainer) {
            feedbackListContainer.innerHTML = `<div class="no-feedback">${escapeHtml(message)}</div>`;
        }
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.5s forwards';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
});

