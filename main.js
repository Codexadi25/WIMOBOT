document.addEventListener('DOMContentLoaded', function() {
    // --- IMPORTANT SECURITY WARNING ---
    // This authentication is for demonstration only. It is NOT secure.
    // In a real application, user data and authentication logic MUST be handled on a server.

    // --- Global State ---
    let currentUser = null, activeCategoryIndex = 0, activePnCategoryIndex = 0;
    // Data will be populated from the server via WebSocket
    let userData = [], categories = [], pnsData = []; 
    let allUniqueTags = [], selectedTags = new Set();
    
    // --- All DOM Getters Here For Readability ---
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const appWrapper = document.getElementById('app-wrapper');
    const templatesView = document.getElementById('templates-view');
    const pnsView = document.getElementById('pns-view');
    const templatesTabBtn = document.getElementById('templates-tab-btn');
    const pnsTabBtn = document.getElementById('pns-tab-btn');
    const logoutButton = document.getElementById('logout-button');
    const searchBar = document.getElementById('search-bar');
    const copyNotification = document.getElementById('copy-notification');
    const userRoleDisplay = document.getElementById('user-role-display');

    // --- WebSocket Connection with Reconnect Logic ---
    let ws; 

    function connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onopen = () => {
            console.log('Connected to WebSocket server.');
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            const data = message.payload;

            userData = data.users;
            categories = data.categories;
            pnsData = data.pnsData;

            processAllTags();
            if (currentUser) {
                if (!templatesView.classList.contains('hidden')) {
                    renderCategories();
                    renderTagFilterRibbon();
                    displayTemplates(activeCategoryIndex);
                } else if (!pnsView.classList.contains('hidden')) {
                    pnsView.innerHTML = ''; 
                    buildPNsView();
                }
            }
        };

        ws.onclose = () => {
            console.log('Disconnected. Reconnecting in 5 seconds...');
            setTimeout(connect, 5000);
        };

        ws.onerror = (err) => {
            console.error('WebSocket error:', err);
            ws.close();
        };
    }
    
    connect();

    // --- Helper function to update user info in Nav-Bar ---
    function updateUserInfo() {
        if (currentUser) {
            userRoleDisplay.textContent = currentUser.role;
        }
    }

    function checkSession() {
      const storedUser = sessionStorage.getItem('wimoBotCurrentUser');
      if (storedUser) {
          currentUser = JSON.parse(storedUser);
          updateUserInfo(); // <-- Update nav-bar on session load
          loginOverlay.classList.add('hidden');
          appWrapper.classList.remove('hidden');
      }
    }
    
    function processAllTags() {
        const tagSet = new Set();
        categories.forEach(cat => cat.templates.forEach(tpl => tpl.tags.forEach(tag => tagSet.add(tag))));
        allUniqueTags = [...tagSet].sort();
    }

    function handleLogin(e) {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const foundUser = userData.find(u => u.username === username && u.password === password);
      if (foundUser) {
        currentUser = foundUser;
        updateUserInfo(); // <-- Update nav-bar on login
        sessionStorage.setItem('wimoBotCurrentUser', JSON.stringify(currentUser));
        loginOverlay.classList.add('hidden');
        appWrapper.classList.remove('hidden');
        initializeApp();
      } else {
        document.getElementById('login-error').textContent = 'Invalid username or password.';
      }
    }
    function handleLogout() { sessionStorage.removeItem('wimoBotCurrentUser'); location.reload(); }

    function initializeApp() {
      setupTemplatesLayout();
      renderCategories();
      renderTagFilterRibbon();
      
      logoutButton.addEventListener('click', handleLogout);
      searchBar.addEventListener('input', () => displayTemplates(activeCategoryIndex));
      templatesTabBtn.addEventListener('click', showTemplatesView);
      pnsTabBtn.addEventListener('click', showPNsView);

      if (categories.length > 0) {
        activeCategoryIndex = 0;
        document.querySelector('.category-header[data-index="0"]')?.classList.add('active');
        displayTemplates(0);
      }
    }

    function showTemplatesView() {
        templatesView.classList.remove('hidden');
        pnsView.classList.add('hidden');
        templatesTabBtn.classList.add('active');
        pnsTabBtn.classList.remove('active');
        searchBar.style.visibility = 'visible';
        displayTemplates(activeCategoryIndex);
    }

    function showPNsView() {
        pnsView.classList.remove('hidden');
        templatesView.classList.add('hidden');
        pnsTabBtn.classList.add('active');
        templatesTabBtn.classList.remove('active');
        searchBar.style.visibility = 'hidden';
        pnsView.innerHTML = '';
        buildPNsView();
    }

    function setupTemplatesLayout() {
        const mainContentWrapper = document.getElementById('main-content-wrapper') || document.createElement('div');
        if (!mainContentWrapper.id) {
            mainContentWrapper.id = 'main-content-wrapper';
            templatesView.appendChild(mainContentWrapper);
        }
        mainContentWrapper.innerHTML = '';
        let adminPanelHtml = '', calculatorPanelHtml = `<div id="calculator-panel" class="panel"></div>`;
        let mainViewHtml = `<div class="container panel"><div class="left-panel"></div><div class="right-panel"><div id="tag-filter-ribbon"></div><div id="right-panel-content"></div></div></div>`;
        if (currentUser.role === 'admin') { adminPanelHtml = `<div id="admin-tools-panel" class="panel"></div>`; }
        mainContentWrapper.innerHTML = adminPanelHtml + mainViewHtml + calculatorPanelHtml;
        if (currentUser.role === 'admin') createAdminTools();
        createCalculatorTools();
    };
    
    function renderCategories() {
      const leftPanel = document.querySelector('#templates-view .left-panel');
      if (!leftPanel) return;
      leftPanel.innerHTML = '';
      const allCatHeader = document.createElement('div');
      allCatHeader.className = 'category-header';
      allCatHeader.textContent = 'All Categories';
      if (activeCategoryIndex === -1) { allCatHeader.classList.add('active'); }
      allCatHeader.addEventListener('click', () => {
          activeCategoryIndex = -1;
          selectedTags.clear();
          renderCategories(); renderTagFilterRibbon();
          displayTemplates(-1);
      });
      leftPanel.appendChild(allCatHeader);

      categories.forEach((category, index) => {
        const header = document.createElement('div');
        header.className = 'category-header';
        header.dataset.index = index;
        
        const titleSpan = document.createElement('span');
        titleSpan.textContent = category.title;
        header.appendChild(titleSpan);

        if (currentUser.role === 'admin') {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-category-btn';
            deleteBtn.innerHTML = '&#128465;';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete the entire "${category.title}" category?`)) {
                    categories.splice(index, 1);
                    ws.send(JSON.stringify({ type: 'update-categories', payload: categories }));
                    activeCategoryIndex = -1;
                }
            };
            header.appendChild(deleteBtn);
        }

        header.addEventListener('click', () => {
          activeCategoryIndex = index;
          renderCategories();
          displayTemplates(index);
        });

        if (index === activeCategoryIndex) { header.classList.add('active'); }
        leftPanel.appendChild(header);
      });
    };

    // --- MODIFIED to include Clear Filters button ---
    function renderTagFilterRibbon() {
      const ribbon = document.getElementById('tag-filter-ribbon'); if (!ribbon) return;
      ribbon.innerHTML = '';
      allUniqueTags.forEach(tag => {
          const btn = document.createElement('button');
          btn.className = 'tag-filter-btn';
          btn.textContent = tag.replace(/_/g, ' ');
          if (selectedTags.has(tag)) { btn.classList.add('active'); }
          btn.addEventListener('click', () => {
              if (selectedTags.has(tag)) { selectedTags.delete(tag); } else { selectedTags.add(tag); }
              activeCategoryIndex = -1; renderCategories(); renderTagFilterRibbon(); displayTemplates(-1);
          });
          ribbon.appendChild(btn);
      });

      // Add the "Clear Filters" button only if a filter is active
      if (selectedTags.size > 0 || activeCategoryIndex !== -1) {
          const clearBtn = document.createElement('button');
          clearBtn.className = 'clear-filters-btn';
          clearBtn.textContent = 'Clear Filters';
          clearBtn.onclick = () => {
              activeCategoryIndex = -1;
              selectedTags.clear();
              renderCategories();
              renderTagFilterRibbon();
              displayTemplates(-1);
          };
          ribbon.appendChild(clearBtn);
      }
    };
    
    function displayTemplates(categoryIndex) {
      const rightPanelContent = document.getElementById('right-panel-content');
      if (!rightPanelContent) return;
      rightPanelContent.innerHTML = '';
      const searchKeywords = searchBar.value.toLowerCase().split(' ').filter(Boolean);
      let templatesToDisplay = [];
      if (categoryIndex === -1) {
          categories.forEach((cat, catIdx) => {
              cat.templates.forEach((template, tplIdx) => { templatesToDisplay.push({ ...template, originalCatIndex: catIdx, originalTplIndex: tplIdx, categoryTitle: cat.title }); });
          });
      } else if (categories[categoryIndex]) {
          categories[categoryIndex].templates.forEach((template, tplIdx) => { templatesToDisplay.push({ ...template, originalCatIndex: categoryIndex, originalTplIndex: tplIdx }); });
      }
      const filteredTemplates = templatesToDisplay.filter(template => {
          const searchMatch = searchKeywords.length === 0 || searchKeywords.every(keyword => template.text.toLowerCase().includes(keyword) || template.tags.some(tag => tag.toLowerCase().includes(keyword)));
          const tagMatch = selectedTags.size === 0 || [...selectedTags].every(selectedTag => template.tags.includes(selectedTag));
          return searchMatch && tagMatch;
      });
      if (filteredTemplates.length === 0) { rightPanelContent.innerHTML = `<h2>No matching templates found.</h2>`; }
      filteredTemplates.forEach((template) => {
        const card = document.createElement('div'); card.className = 'template-card';
        if (template.categoryTitle) { const catLabel = document.createElement('div'); catLabel.className = 'card-category-label'; catLabel.textContent = `Category: ${template.categoryTitle}`; card.appendChild(catLabel); }
        const tagsContainer = document.createElement('div'); tagsContainer.className = 'tags-container';
        template.tags.forEach(tagName => { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = tagName; tagsContainer.appendChild(tag); });
        const textBlock = document.createElement('div'); textBlock.className = 'template-text'; textBlock.textContent = template.text;
        textBlock.addEventListener('click', () => { navigator.clipboard.writeText(template.text).then(showCopyNotification); });
        card.appendChild(tagsContainer); card.appendChild(textBlock);
        if (currentUser.role === 'admin') {
          const adminControls = document.createElement('div'); adminControls.className = 'admin-controls';
          const editBtn = document.createElement('button'); editBtn.innerHTML = '&#9998;'; editBtn.className = 'admin-btn edit'; editBtn.onclick = () => editTemplate(template.originalCatIndex, template.originalTplIndex);
          const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '&#128465;'; deleteBtn.className = 'admin-btn delete'; deleteBtn.onclick = () => deleteTemplate(template.originalCatIndex, template.originalTplIndex);
          adminControls.appendChild(editBtn); adminControls.appendChild(deleteBtn);
          card.appendChild(adminControls);
        }
        rightPanelContent.appendChild(card);
      });
    };
    
    function createAdminTools() {
      const panel = document.getElementById('admin-tools-panel');
      if (!panel) return;
      const addForm = document.createElement('form'); addForm.className = 'tool-section';
      let categoryOptions = categories.map((cat, index) => `<option value="${index}">${cat.title}</option>`).join('');
      addForm.innerHTML = `<h3>Add New Template</h3><label for="category-select">Category:</label><select id="category-select">${categoryOptions}<option value="--new--">Create New Category...</option></select><input type="text" id="new-category-name" placeholder="New category name..." class="hidden"><label for="new-template-text">Template Text:</label><textarea id="new-template-text" required></textarea><label for="new-template-tags">Tags (comma-separated):</label><input type="text" id="new-template-tags" required><button type="submit">Add Template</button>`;
      addForm.querySelector('#category-select').addEventListener('change', function() { document.getElementById('new-category-name').classList.toggle('hidden', this.value !== '--new--'); });
      addForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const text = document.getElementById('new-template-text').value; const tags = document.getElementById('new-template-tags').value.split(',').map(t => t.trim()).filter(Boolean);
          if (!text || tags.length === 0) { alert('Text and tags cannot be empty.'); return; }
          const newTemplate = { text, tags }; let targetCategoryIndex = document.getElementById('category-select').value;
          if (targetCategoryIndex === '--new--') {
              const newCategoryName = document.getElementById('new-category-name').value.trim();
              if (!newCategoryName) { alert('New category name cannot be empty.'); return; }
              categories.push({ title: newCategoryName, templates: [newTemplate] });
              activeCategoryIndex = categories.length - 1;
          } else { 
              categories[targetCategoryIndex].templates.push(newTemplate); 
              activeCategoryIndex = parseInt(targetCategoryIndex);
          }
          ws.send(JSON.stringify({ type: 'update-categories', payload: categories }));
          addForm.reset(); document.getElementById('new-category-name').classList.add('hidden');
      });
      const passwordForm = document.createElement('form');
      let userOptions = userData.map(u => `<option value="${u.username}">${u.username}</option>`).join('');
      passwordForm.innerHTML = `<h3>Change Password</h3> <label for="user-select">User:</label> <select id="user-select">${userOptions}</select> <label for="new-password">New Password:</label> <input type="password" id="new-password" required> <button type="submit">Update Password</button> <div class="feedback-text success" id="password-change-feedback"></div>`;
      passwordForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const usernameToChange = document.getElementById('user-select').value;
          const newPassword = document.getElementById('new-password').value;
          const userToUpdate = userData.find(u => u.username === usernameToChange);
          if(userToUpdate) {
              userToUpdate.password = newPassword;
              ws.send(JSON.stringify({ type: 'update-users', payload: userData }));
              const feedback = document.getElementById('password-change-feedback');
              feedback.textContent = `Password for ${usernameToChange} updated!`;
              setTimeout(() => feedback.textContent = '', 3000);
          }
          document.getElementById('new-password').value = '';
      });
      panel.appendChild(addForm); panel.appendChild(passwordForm);
    };

    function editTemplate(catIndex, tplIndex) {
        const tpl = categories[catIndex].templates[tplIndex];
        const newText = prompt('Edit the template text:', tpl.text);
        if (newText && newText.trim()) {
            tpl.text = newText;
            const newTagsRaw = prompt('Edit tags (comma-separated):', tpl.tags.join(', '));
            if (newTagsRaw !== null) { 
                tpl.tags = newTagsRaw.split(',').map(t => t.trim()).filter(Boolean);
                ws.send(JSON.stringify({ type: 'update-categories', payload: categories }));
            }
        }
    };

    function deleteTemplate(catIndex, tplIndex) {
        if (confirm('Are you sure you want to delete this template?')) {
            categories[catIndex].templates.splice(tplIndex, 1);
            ws.send(JSON.stringify({ type: 'update-categories', payload: categories }));
        }
    };

    function buildPNsView() {
        if (!pnsView) return;
        pnsView.innerHTML = `<div class="panel container"><div class="left-panel" id="pns-category-panel"></div><div class="right-panel" id="pns-content-panel"></div></div>`;
        renderPNCategories();
        if (pnsData.length > 0) { displayPNs(activePnCategoryIndex); }
    };

    function renderPNCategories() {
        const panel = document.getElementById('pns-category-panel');
        if (!panel) return;
        panel.innerHTML = '';
        pnsData.forEach((cat, index) => {
            const header = document.createElement('div');
            header.className = 'category-header';
            header.textContent = cat.title;
            if (index === activePnCategoryIndex) { header.classList.add('active'); }
            header.addEventListener('click', () => { activePnCategoryIndex = index; renderPNCategories(); displayPNs(index); });
            panel.appendChild(header);
        });
        const addCatBtn = document.createElement('button');
        addCatBtn.textContent = '+ New Category';
        addCatBtn.style.width = '100%'; addCatBtn.style.marginTop = '15px';
        addCatBtn.addEventListener('click', () => {
            const name = prompt('Enter new category name:');
            if (name && name.trim()) {
                pnsData.push({ title: name.trim(), notes: [] });
                ws.send(JSON.stringify({ type: 'update-pns', payload: pnsData }));
            }
        });
        panel.appendChild(addCatBtn);
    };

    function displayPNs(pnCatIndex) {
        const panel = document.getElementById('pns-content-panel');
        if (!panel) return;
        panel.innerHTML = '';
        const category = pnsData[pnCatIndex];
        if (!category) { panel.innerHTML = '<h2>Select or create a category.</h2>'; return; }
        
        category.notes.forEach((note, noteIndex) => {
            const card = document.createElement('div'); card.className = 'pn-card';
            card.innerHTML = `<h4>${note.title}</h4><div class="pn-content">${note.content.replace(/\n/g, '<br>')}</div>`;
            const controls = document.createElement('div'); controls.className = 'pn-controls';
            const editBtn = document.createElement('button'); editBtn.innerHTML = '&#9998;'; editBtn.className = 'pn-btn edit';
            editBtn.onclick = () => {
                const newTitle = prompt('Edit note title:', note.title);
                const newContent = prompt('Edit note content:', note.content);
                if (newTitle !== null && newContent !== null) {
                    pnsData[pnCatIndex].notes[noteIndex] = { title: newTitle, content: newContent };
                    ws.send(JSON.stringify({ type: 'update-pns', payload: pnsData }));
                }
            };
            const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '&#128465;'; deleteBtn.className = 'pn-btn delete';
            deleteBtn.onclick = () => {
                if (confirm('Delete this note?')) {
                    pnsData[pnCatIndex].notes.splice(noteIndex, 1);
                    ws.send(JSON.stringify({ type: 'update-pns', payload: pnsData }));
                }
            };
            controls.appendChild(editBtn); controls.appendChild(deleteBtn);
            card.appendChild(controls);
            panel.appendChild(card);
        });
        
        const addNoteForm = document.createElement('form'); addNoteForm.className = 'tool-section';
        addNoteForm.innerHTML = `<h3>Add New Note</h3><input id="new-pn-title" placeholder="Note Title" required><textarea id="new-pn-content" placeholder="Note Content..." required></textarea><button type="submit">Add Note</button>`;
        addNoteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = document.getElementById('new-pn-title').value;
            const content = document.getElementById('new-pn-content').value;
            if (title && content) {
                pnsData[pnCatIndex].notes.push({ title, content });
                ws.send(JSON.stringify({ type: 'update-pns', payload: pnsData }));
                addNoteForm.reset();
            }
        });
        panel.appendChild(addNoteForm);
    };
    
    function createCalculatorTools() {
      const panel = document.getElementById('calculator-panel'); if (!panel) return;
      const percentOfForm = document.createElement('form'); percentOfForm.className = 'tool-section';
      percentOfForm.innerHTML = `<h3>Percent of an Amount</h3><label for="percent-input">Calculate:</label><input type="number" id="percent-input" placeholder="e.g., 35" required>% of <input type="number" id="amount-input" placeholder="e.g., 246" required><button type="submit">Calculate</button><p id="percent-of-result" class="calc-result"></p>`;
      percentOfForm.addEventListener('submit', (e) => { e.preventDefault(); const percent = parseFloat(document.getElementById('percent-input').value); const amount = parseFloat(document.getElementById('amount-input').value); const resultEl = document.getElementById('percent-of-result'); if (!isNaN(percent) && !isNaN(amount)) { const result = (percent / 100) * amount; resultEl.textContent = `Result: ${result.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`; } else { resultEl.textContent = 'Invalid input'; } });
      const fractionForm = document.createElement('form'); fractionForm.className = 'tool-section';
      fractionForm.innerHTML = `<h3>Get Percent from Fraction</h3><label for="fraction-input">Fraction:</label><input type="text" id="fraction-input" placeholder="e.g., 34/454" required><button type="submit">Get Percent</button><p id="fraction-result" class="calc-result"></p>`;
      fractionForm.addEventListener('submit', (e) => { e.preventDefault(); const expression = document.getElementById('fraction-input').value; const resultEl = document.getElementById('fraction-result'); if (expression.includes('/')) { const parts = expression.split('/'); const numerator = parseFloat(parts[0]); const denominator = parseFloat(parts[1]); if (parts.length === 2 && !isNaN(numerator) && !isNaN(denominator)) { if (denominator === 0) { resultEl.textContent = "Cannot divide by zero"; } else { const result = (numerator / denominator) * 100; resultEl.textContent = `${result.toFixed(2)}%`; } } else { resultEl.textContent = "Invalid fraction"; } } else { resultEl.textContent = "Use format: number/number"; } });
      panel.appendChild(percentOfForm); panel.appendChild(fractionForm);
    };

    function showCopyNotification() {
      copyNotification.classList.add('show');
      setTimeout(() => copyNotification.classList.remove('show'), 2000);
    };
    
    loginForm.addEventListener('submit', handleLogin);
    checkSession();
});