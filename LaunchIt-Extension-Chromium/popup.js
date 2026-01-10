// Default LaunchIt server URL
const LAUNCHIT_SERVER = 'http://localhost:5174';

// Load current tab info when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab.url) {
    document.getElementById('url').value = tab.url;
    document.getElementById('name').value = tab.title || '';
  }

  // Check connection status first
  await checkConnection();

  // Load groups
  await loadGroups();

  // Check for duplicate
  if (tab.url) {
    await checkDuplicateUrl(tab.url);
  }

  // Make status clickable to retry connection
  const statusDiv = document.getElementById('connectionStatus');
  statusDiv.addEventListener('click', async () => {
    await checkConnection();
    await loadGroups();
  });

  // Shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      const submitBtn = document.getElementById('submitBtn');
      if (!submitBtn.disabled) {
        submitBtn.click();
      }
    }
  });

  // Magic Buttons
  document.getElementById('magicGroup').addEventListener('click', suggestGroup);
  document.getElementById('magicDesc').addEventListener('click', generateDescription);
  document.getElementById('magicTags').addEventListener('click', suggestTags);

  // Tabs
  // Tabs
  // Load saved tab
  const lastTab = localStorage.getItem('lastActiveTab') || 'tab-add';
  const savedBtn = document.querySelector(`.tab-btn[data-tab="${lastTab}"]`);
  if (savedBtn) {
    // Remove active from default (Add)
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Activate saved
    savedBtn.classList.add('active');
    document.getElementById(lastTab).classList.add('active');

    // Focus search if it was the last tab
    if (lastTab === 'tab-search') {
      setTimeout(() => document.getElementById('searchInput').focus(), 100);
    }
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      // Add active to clicked
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      document.getElementById(tabId).classList.add('active');

      // Save to localStorage
      localStorage.setItem('lastActiveTab', tabId);

      // Load specific tab data
      if (tabId === 'tab-info') {
        loadStats();
      } else if (tabId === 'tab-search') {
        document.getElementById('searchInput').focus();
      }
    });
  });

  // Search
  const searchInput = document.getElementById('searchInput');
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(e.target.value);
    }, 300);
  });

  // Check AI capability
  checkAICapability();
});

async function checkAICapability() {
  try {
    const response = await fetch(`${LAUNCHIT_SERVER}/api/stats`);
    const result = await response.json();
    if (result.success && result.data.aiEnabled === false) {
      document.querySelectorAll('.magic-btn').forEach(btn => {
        btn.disabled = true;
        btn.title = "AI features disabled. Configure API Key in LaunchIt Settings.";
        btn.style.opacity = '0.3';
        btn.style.cursor = 'not-allowed';
      });
    }
  } catch (e) {
    console.warn('Could not check AI capability');
  }
}

async function performSearch(query) {
  const container = document.getElementById('searchResults');
  if (!query) {
    container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">Type to search...</div>';
    return;
  }

  container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">Searching...</div>';

  try {
    const response = await fetch(`${LAUNCHIT_SERVER}/api/search?q=${encodeURIComponent(query)}`);
    const result = await response.json();

    if (result.success && result.data && result.data.length > 0) {
      container.innerHTML = result.data.map(item => `
        <div class="search-item" data-url="${item.url}">
          <img src="${item.icon || 'icons/icon48.png'}" onerror="this.src='icons/icon48.png'">
          <div class="search-item-info">
            <div class="search-item-title">${item.name}</div>
            <div class="search-item-url">${item.url || 'No URL'}</div>
          </div>
        </div>
      `).join('');

      // Add click listeners
      container.querySelectorAll('.search-item').forEach(el => {
        el.addEventListener('click', () => {
          const url = el.getAttribute('data-url');
          if (url) openLink(url);
        });
      });
    } else {
      container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">No results found</div>';
    }
  } catch (error) {
    container.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">Search failed</div>';
  }
}

function openLink(url) {
  if (url) chrome.tabs.create({ url });
}

async function loadStats() {
  const container = document.getElementById('vaultStats');
  try {
    const response = await fetch(`${LAUNCHIT_SERVER}/api/stats`);
    const result = await response.json();
    if (result.success) {
      container.innerHTML = `
        <div><strong>${result.data.itemsCount}</strong> Items</div>
        <div><strong>${result.data.groupsCount}</strong> Groups</div>
        <div style="margin-top: 5px; opacity: 0.7;">v${result.data.version}</div>
      `;
    }
  } catch (error) {
    container.innerHTML = 'Could not load stats';
  }
}

// AI Helper Functions
async function suggestGroup() {
  const btn = document.getElementById('magicGroup');
  const span = btn.querySelector('span') || btn;
  const originalText = span.textContent;

  setButtonLoading(btn, true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Get page HTML for better context (if possible)
    let html = '';
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText.substring(0, 2000) // First 2000 chars of text
      });
      html = results[0].result;
    } catch (e) {
      console.warn('Could not get page text', e);
    }

    const response = await fetch(`${LAUNCHIT_SERVER}/api/ai/suggest-group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: tab.title,
        url: tab.url,
        html
      })
    });

    const result = await response.json();
    if (result.success && result.data.groupId) {
      document.getElementById('group').value = result.data.groupId;
      showStatus(`Suggesting: ${result.data.groupName}`, 'success');
    } else {
      showStatus('No group suggestion found', 'error');
    }
  } catch (error) {
    console.error('AI Error:', error);
    showStatus('AI suggestion failed', 'error');
  } finally {
    setButtonLoading(btn, false, '✨');
  }
}

async function generateDescription() {
  const btn = document.getElementById('magicDesc');
  setButtonLoading(btn, true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const response = await fetch(`${LAUNCHIT_SERVER}/api/ai/generate-description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: tab.title, url: tab.url })
    });

    const result = await response.json();
    if (result.success && result.data) {
      document.getElementById('description').value = result.data;
    } else {
      showStatus('Could not generate description', 'error');
    }
  } catch (error) {
    console.error('AI Error:', error);
    showStatus('AI generation failed', 'error');
  } finally {
    setButtonLoading(btn, false, '✨');
  }
}

async function suggestTags() {
  const btn = document.getElementById('magicTags');
  setButtonLoading(btn, true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const description = document.getElementById('description').value;

    const response = await fetch(`${LAUNCHIT_SERVER}/api/ai/suggest-tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: tab.title, url: tab.url, description })
    });

    const result = await response.json();
    if (result.success && result.data) {
      const currentTags = document.getElementById('tags').value;
      const newTags = result.data.join(', ');
      document.getElementById('tags').value = currentTags ? `${currentTags}, ${newTags}` : newTags;
    } else {
      showStatus('No tags suggested', 'error');
    }
  } catch (error) {
    console.error('AI Error:', error);
    showStatus('AI suggestion failed', 'error');
  } finally {
    setButtonLoading(btn, false, '✨');
  }
}

function setButtonLoading(btn, isLoading, originalText = '') {
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = '<div class="magic-spinner"></div>';
  } else {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function checkDuplicateUrl(url) {
  try {
    const response = await fetch(`${LAUNCHIT_SERVER}/api/bookmarks/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const result = await response.json();
    if (result.success && result.exists) {
      showStatus('⚠️ This URL is already in LaunchIt', 'error');
      // Optional: Disable submit or change text?
      // For now just warning is good.
    }
  } catch (error) {
    console.warn('Duplicate check failed', error);
  }
}

async function checkConnection() {
  const statusDiv = document.getElementById('connectionStatus');
  const statusIcon = document.getElementById('statusIcon');
  const statusText = document.getElementById('statusText');

  statusDiv.className = 'connection-status checking';
  statusIcon.textContent = '⏳';
  statusText.textContent = 'Checking connection...';
  statusDiv.classList.add('clickable');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${LAUNCHIT_SERVER}/api/groups`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      statusDiv.className = 'connection-status connected';
      statusIcon.textContent = '✓';
      statusText.textContent = 'LaunchIt is running';
      statusDiv.classList.remove('clickable');
      return true;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    statusDiv.className = 'connection-status disconnected';
    statusIcon.textContent = '✗';
    if (error.name === 'AbortError') {
      statusText.textContent = 'Connection timeout (click to retry)';
    } else {
      statusText.textContent = 'LaunchIt not running (click to retry)';
    }
    statusDiv.classList.add('clickable');
    return false;
  }
}

async function loadGroups() {
  const groupSelect = document.getElementById('group');
  groupSelect.innerHTML = '<option value="">Loading groups...</option>';
  groupSelect.disabled = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${LAUNCHIT_SERVER}/api/groups`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const groups = await response.json();

    if (!Array.isArray(groups)) {
      throw new Error('Invalid response format');
    }

    if (groups.length === 0) {
      groupSelect.innerHTML = '<option value="">No groups available. Create a group in LaunchIt first.</option>';
      groupSelect.disabled = false;
      return;
    }

    groupSelect.innerHTML = groups.map(group =>
      `<option value="${group.id}">${group.icon || '📁'} ${group.name}</option>`
    ).join('');

    // Select first group by default
    if (groups.length > 0) {
      groupSelect.value = groups[0].id;
    }

    // Add "Create New Group" option
    const newOption = document.createElement('option');
    newOption.value = '__NEW_GROUP__';
    newOption.textContent = '+ Create New Group';
    newOption.style.fontWeight = 'bold';
    groupSelect.appendChild(newOption);

    groupSelect.disabled = false;
  } catch (error) {
    console.error('Failed to load groups:', error);
    groupSelect.innerHTML = '<option value="">Error: LaunchIt not running or connection failed</option>';
    groupSelect.disabled = false;

    // Update connection status if groups failed to load
    if (error.name === 'AbortError' || error.message.includes('fetch')) {
      const statusDiv = document.getElementById('connectionStatus');
      const statusIcon = document.getElementById('statusIcon');
      const statusText = document.getElementById('statusText');
      statusDiv.className = 'connection-status disconnected';
      statusIcon.textContent = '✗';
      statusText.textContent = 'LaunchIt not running (click to retry)';
      statusDiv.classList.add('clickable');
    }
  }
}

// Handle New Group UI
const groupSelect = document.getElementById('group');
const newGroupInput = document.getElementById('newGroupName');
const cancelNewGroupBtn = document.getElementById('cancelNewGroup');
const magicGroupBtn = document.getElementById('magicGroup');

groupSelect.addEventListener('change', (e) => {
  if (e.target.value === '__NEW_GROUP__') {
    groupSelect.classList.add('hidden');
    magicGroupBtn.classList.add('hidden');
    newGroupInput.classList.remove('hidden');
    cancelNewGroupBtn.classList.remove('hidden');
    newGroupInput.focus();
    newGroupInput.required = true;
    groupSelect.required = false;
  }
});

cancelNewGroupBtn.addEventListener('click', () => {
  newGroupInput.classList.add('hidden');
  cancelNewGroupBtn.classList.add('hidden');
  groupSelect.classList.remove('hidden');
  magicGroupBtn.classList.remove('hidden');
  groupSelect.value = groupSelect.querySelector('option') ? groupSelect.querySelector('option').value : '';
  newGroupInput.value = '';
  newGroupInput.required = false;
  groupSelect.required = true;
});

// Create Group Helper
async function createNewGroup(name) {
  const response = await fetch(`${LAUNCHIT_SERVER}/api/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, icon: '📁' })
  });
  const result = await response.json();
  if (result.success) return result.data;
  throw new Error(result.error || 'Failed to create group');
}

document.getElementById('bookmarkForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById('submitBtn');
  const submitText = document.getElementById('submitText');
  const submitSpinner = document.getElementById('submitSpinner');
  const status = document.getElementById('status');

  const name = document.getElementById('name').value.trim();
  const url = document.getElementById('url').value.trim();
  const description = document.getElementById('description').value.trim();

  // Shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      document.getElementById('submitBtn').click();
    }
  });

  const tags = document.getElementById('tags').value.trim();
  let groupId = document.getElementById('group').value;
  const newGroupName = document.getElementById('newGroupName').value.trim();
  const isNewGroupMode = !document.getElementById('newGroupName').classList.contains('hidden');

  if (isNewGroupMode) {
    if (!newGroupName) {
      showStatus('Please enter a group name', 'error');
      return;
    }
    // We'll create the group in the try block
  } else if (!name || !url || !groupId) {
    showStatus('Please fill in all required fields', 'error');
    return;
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    showStatus('Invalid URL', 'error');
    return;
  }

  // Disable form
  submitBtn.disabled = true;
  submitText.textContent = 'Adding...';
  submitSpinner.classList.remove('hidden');
  status.classList.add('hidden');

  try {
    // Create group if needed
    if (isNewGroupMode) {
      submitText.textContent = 'Creating Group...';
      const group = await createNewGroup(newGroupName);
      groupId = group.id;
      submitText.textContent = 'Adding Bookmark...';
    }

    const response = await fetch(`${LAUNCHIT_SERVER}/api/bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        url,
        description: description || undefined,
        tags: tags || undefined,
        groupId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      showStatus('✓ Bookmark added successfully!', 'success');

      // Reset form
      document.getElementById('name').value = '';
      document.getElementById('url').value = '';
      document.getElementById('description').value = '';
      document.getElementById('tags').value = '';

      // Close popup after 1.5 seconds
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      throw new Error(result.error || 'Failed to add bookmark');
    }
  } catch (error) {
    console.error('Error adding bookmark:', error);
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = 'Add to LaunchIt';
    submitSpinner.classList.add('hidden');
  }
});

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  status.classList.remove('hidden');
}

