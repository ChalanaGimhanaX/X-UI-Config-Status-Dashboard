// Print credit to console
console.log('%c Made by chAlnA ', 'background: #4a69bd; color: white; padding: 10px; font-size: 16px; border-radius: 5px;');

// DOM Elements
const loginContainer = document.getElementById('login-container');
const dashboard = document.getElementById('dashboard');
const usernameInput = document.getElementById('username-input');
const searchBtn = document.getElementById('search-btn');
const logoutBtn = document.getElementById('logout-btn');
const panelContainer = document.getElementById('panel-container');
const loginError = document.getElementById('login-error');
const loader = document.getElementById('loader');

// Event Listeners
searchBtn.addEventListener('click', checkConfigStatus);
logoutBtn.addEventListener('click', showLoginScreen);
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') checkConfigStatus();
});

// Helper function to parse traffic values and convert to bytes
function parseTrafficValue(trafficStr) {
  if (!trafficStr || trafficStr === '0 Bytes') return 0;
  
  // Extract the number and unit
  const matches = trafficStr.match(/^([\d.]+)\s*([A-Za-z]+)$/);
  if (!matches) return 0;
  
  const value = parseFloat(matches[1]);
  const unit = matches[2];
  
  // Convert to bytes based on unit
  switch (unit.toUpperCase()) {
    case 'B':
    case 'BYTES':
      return value;
    case 'KB':
      return value * 1024;
    case 'MB':
      return value * 1024 * 1024;
    case 'GB':
      return value * 1024 * 1024 * 1024;
    case 'TB':
      return value * 1024 * 1024 * 1024 * 1024;
    default:
      return value;
  }
}

// Format bytes to appropriate unit
function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
}

// Main Functions
function showLoginScreen() {
  dashboard.style.display = 'none';
  loginContainer.style.display = 'block';
  loginContainer.classList.add('fade-in');
  loginError.style.display = 'none';
  usernameInput.value = '';
  usernameInput.focus();
}

function showDashboard() {
  loginContainer.style.display = 'none';
  dashboard.style.display = 'block';
  dashboard.classList.add('fade-in');
  
  // Trigger animation for panels
  setTimeout(() => {
    const panels = document.querySelectorAll('.status-panel');
    panels.forEach((panel, index) => {
      setTimeout(() => {
        panel.classList.add('slide-in');
      }, index * 100); // Stagger the animations
    });
  }, 100);
}

async function checkConfigStatus() {
  const username = usernameInput.value.trim();
  
  if (!username) {
    showError('Please enter a username_id');
    return;
  }
  
  showLoading(true);
  loginError.style.display = 'none';
  
  try {
    const response = await fetch(`/api/configstatus/${username}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch configuration data');
    }
    
    renderConfigs(data.data);
    showDashboard();
  } catch (error) {
    console.error('Error:', error);
    showError(error.message || 'An unexpected error occurred');
  } finally {
    showLoading(false);
  }
}

function renderConfigs(data) {
  panelContainer.innerHTML = ''; // Clear existing panels
  
  if (data.count === 0) {
    panelContainer.innerHTML = '<div class="card"><h3>No configurations found for this user.</h3></div>';
    return;
  }
  
  // Consolidate and deduplicate configurations
  // We prefer 'client' source entries if both 'inbound' and 'client' entries exist for the same config_name on a server.
  const consolidatedConfigs = new Map(); // Key: `${serverName}-${config_name}`, Value: config object

  data.servers.forEach(server => {
    if (server.configs && server.configs.length > 0) {
      server.configs.forEach(config => {
        const configKey = `${server.name}-${config.config_name}`;
        const existingConfig = consolidatedConfigs.get(configKey);

        // If no existing config, or if the new config is 'client' source and existing is 'inbound',
        // or if new config has a client_id and existing one doesn't (preferring more specific data)
        if (!existingConfig || 
            (config.source === 'client' && existingConfig.source === 'inbound') ||
            (config.client_id && !existingConfig.client_id)) {
          consolidatedConfigs.set(configKey, { ...config, serverName: server.name });
        } else if (existingConfig.source === 'client' && config.source === 'inbound') {
          // Do nothing, keep the existing client-sourced config
        } else if (!existingConfig.client_id && config.client_id) {
            // Prefer config with client_id if existing one doesn't have it
            consolidatedConfigs.set(configKey, { ...config, serverName: server.name });
        }
      });
    }
  });

  if (consolidatedConfigs.size === 0) {
    panelContainer.innerHTML = '<div class="card"><h3>No configurations found after filtering.</h3></div>';
    return;
  }
  
  // Create a panel for each consolidated config
  consolidatedConfigs.forEach(config => {
    const panel = document.createElement('div');
    panel.className = 'card status-panel float';
    
    let statusBadgeClass = 'badge-offline';
    let statusText = 'Offline';
    
    if (config.status === 'Enabled') {
      statusBadgeClass = 'badge-online';
      statusText = 'Enabled';
    }
    
    // Format expiry date and handle unlimited cases
    const expiryDate = parseExpiryDate(config.expiry_date);
    let expiryText = '';
    let daysLeftText = '';
    
    if (!expiryDate || (expiryDate.getTime() === 0) || expiryDate.getFullYear() > 2100) {
      expiryText = 'Never Expires';
      daysLeftText = 'Unlimited';
    } else {
      const now = new Date();
      const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
      expiryText = formatDate(expiryDate);
      daysLeftText = daysLeft > 0 ? `${daysLeft} days left` : 'Expired';
    }
    
    // Parse and calculate traffic values
    let uploadBytes = 0;
    let downloadBytes = 0;
    let totalBytes = 0;
    
    // Parse upload
    if (config.up) {
      uploadBytes = parseTrafficValue(config.up);
    }
    
    // Parse download
    if (config.down) {
      downloadBytes = parseTrafficValue(config.down);
    }
    
    // Calculate total
    if (config.total && config.total !== '0 Bytes') {
      totalBytes = parseTrafficValue(config.total);
    } else {
      // If total is missing or zero, sum upload and download
      totalBytes = uploadBytes + downloadBytes;
    }
    
    // Format for display
    const uploadFormatted = config.up || "0 Bytes";
    const downloadFormatted = config.down || "0 Bytes";
    const totalFormatted = formatBytes(totalBytes);
    
    // Create a unique ID for the QR code
    const qrId = `qr-${config.serverName}-${config.client_id || Math.random().toString(36).substring(2, 10)}`;
    
    panel.innerHTML = `
      <div class="status-header">
        <h3>${config.config_name}</h3>
        <span class="status-badge ${statusBadgeClass}">${statusText}</span>
      </div>
      <div class="status-detail"><strong>Server:</strong> ${config.serverName}</div>
      ${config.client_id ? `<div class="status-detail"><strong>Client ID:</strong> <span class="uuid">${config.client_id}</span></div>` : ''}
      <div class="status-detail"><strong>Expiry Date:</strong> ${expiryText} (${daysLeftText})</div>
      ${config.port ? `<div class="status-detail"><strong>Port:</strong> ${config.port}</div>` : ''}
      
      <div class="traffic-stats">
        <div class="traffic-item">
          <div class="traffic-label">Upload</div>
          <div class="traffic-value">${uploadFormatted}</div>
        </div>
        <div class="traffic-item">
          <div class="traffic-label">Download</div>
          <div class="traffic-value">${downloadFormatted}</div>
        </div>
        <div class="traffic-item">
          <div class="traffic-label">Total</div>
          <div class="traffic-value">${totalFormatted}</div>
        </div>
      </div>
      
      ${config.comment ? `<div class="status-detail"><strong>Comment:</strong> ${config.comment}</div>` : ''}
      
      <div class="action-buttons">
        <div class="action-group">
          ${config.vless_url ? `
            <button class="btn copy-btn" onclick="copyToClipboard('${config.vless_url}')">
              <i class="fas fa-copy"></i> Copy URL
            </button>
            <button class="btn qr-btn" onclick="toggleQRCode('${qrId}')">
              <i class="fas fa-qrcode"></i> QR Code
            </button>
          ` : ''}
        </div>
        <span class="copy-tooltip">Copied!</span>
      </div>
      
      ${config.vless_url ? `
        <div class="qr-container" id="${qrId}" style="display:none;">
          <div class="qr-title">Scan to import configuration</div>
          <div class="qr-code" id="${qrId}-img"></div>
        </div>
      ` : ''}
    `;
    
    panelContainer.appendChild(panel);
    
    // Generate QR code if VLESS URL exists
    if (config.vless_url) {
      setTimeout(() => {
        generateQRCode(`${qrId}-img`, config.vless_url);
      }, 100);
    }
  });
}

// Function to generate QR code
function generateQRCode(elementId, data) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  // Clear any existing content
  element.innerHTML = '';
  
  // Create QR code
  new QRCode(element, {
    text: data,
    width: 150,
    height: 150,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

// Toggle QR code display
window.toggleQRCode = function(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  if (element.style.display === 'none' || !element.style.display) {
    element.style.display = 'flex';
  } else {
    element.style.display = 'none';
  }
}

// Make sure copyToClipboard is available in the global scope
window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Show copy animation
    const tooltips = document.querySelectorAll('.copy-tooltip');
    tooltips.forEach(tooltip => {
      tooltip.classList.add('show');
      tooltip.textContent = 'Copied!';
      setTimeout(() => {
        tooltip.classList.remove('show');
      }, 2000);
    });
  }).catch(err => {
    console.error('Failed to copy: ', err);
    alert('Failed to copy VLESS URL to clipboard.');
  });
}

// Date helper functions
function parseExpiryDate(dateStringOrTimestamp) {
  if (!dateStringOrTimestamp || dateStringOrTimestamp === 0 || dateStringOrTimestamp === '0') {
    return new Date(0); // Represents "Never Expires" or an epoch start
  }
  
  let date;
  // Check if it's a number (timestamp)
  if (typeof dateStringOrTimestamp === 'number') {
    // If timestamp is very small, assume it's in seconds (e.g. X-UI panel might return 0 for no expiry)
    // Or if it's a typical millisecond timestamp length
    if (dateStringOrTimestamp === 0) {
        return new Date(0); // Explicitly handle 0 timestamp
    }
    if (dateStringOrTimestamp < 100000000000) { // Likely seconds
      date = new Date(dateStringOrTimestamp * 1000);
    } else { // Likely milliseconds
      date = new Date(dateStringOrTimestamp);
    }
  } else if (typeof dateStringOrTimestamp === 'string') {
    date = new Date(dateStringOrTimestamp);
  } else {
    // Fallback for unknown types, treat as "Never Expires"
    return new Date(0);
  }
  
  // If parsed date is invalid
  if (isNaN(date.getTime())) {
    console.warn('Invalid date string detected, treating as Never Expires:', dateStringOrTimestamp);
    return new Date(0); // Treat as "Never Expires"
  }

  // If the date is very far in the future, also treat as "Never Expires"
  if (date.getFullYear() > 2100) {
      return new Date(0); // Standardize "Never Expires" to epoch 0 or a specific far future date
  }

  return date;
}

function formatDate(date) {
  if (!date || date.getTime() === 0 || date.getFullYear() > 2100) { // Check for 0 timestamp or far future
    return 'Never Expires';
  }
  
  return date.toLocaleDateString(undefined, {
    year: 'numeric', 
    month: 'short', 
    day: 'numeric'
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Show copy animation
    const tooltips = document.querySelectorAll('.copy-tooltip');
    tooltips.forEach(tooltip => {
      tooltip.classList.add('show');
      tooltip.textContent = 'Copied!';
      setTimeout(() => {
        tooltip.classList.remove('show');
      }, 2000);
    });
  }).catch(err => {
    console.error('Failed to copy: ', err);
    alert('Failed to copy VLESS URL to clipboard.');
  });
}

function showError(message) {
  loginError.textContent = message;
  loginError.style.display = 'block';
  loginError.classList.add('shake');
  
  // Remove animation class after it completes
  setTimeout(() => {
    loginError.classList.remove('shake');
  }, 500);
}

function showLoading(isLoading) {
  loader.style.display = isLoading ? 'block' : 'none';
  if (isLoading) {
    loader.classList.add('spin');
  } else {
    loader.classList.remove('spin');
  }
  searchBtn.disabled = isLoading;
}

// Initialize app
showLoginScreen();
