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

  // Make status clickable to retry connection
  const statusDiv = document.getElementById('connectionStatus');
  statusDiv.addEventListener('click', async () => {
    await checkConnection();
    await loadGroups();
  });
});

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

document.getElementById('bookmarkForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById('submitBtn');
  const submitText = document.getElementById('submitText');
  const submitSpinner = document.getElementById('submitSpinner');
  const status = document.getElementById('status');

  const name = document.getElementById('name').value.trim();
  const url = document.getElementById('url').value.trim();
  const description = document.getElementById('description').value.trim();
  const groupId = document.getElementById('group').value;

  if (!name || !url || !groupId) {
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
    const response = await fetch(`${LAUNCHIT_SERVER}/api/bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        url,
        description: description || undefined,
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

