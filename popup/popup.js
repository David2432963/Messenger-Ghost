/**
 * Messenger Ghost - Popup Script
 */

const toggleEnabled = document.getElementById('toggle-enabled');
const toggleTyping = document.getElementById('toggle-typing');
const toggleSeen = document.getElementById('toggle-seen');
const masterLabel = document.getElementById('master-label');
const featuresSection = document.getElementById('features-section');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const statusBar = document.querySelector('.status-bar');

// ─── Load saved settings ───────────────────────────────────────────────────

chrome.storage.sync.get(['blockTyping', 'blockSeen', 'enabled'], (result) => {
  const enabled = result.enabled !== false;
  const blockTyping = result.blockTyping !== false;
  const blockSeen = result.blockSeen !== false;

  toggleEnabled.checked = enabled;
  toggleTyping.checked = blockTyping;
  toggleSeen.checked = blockSeen;

  updateMasterUI(enabled);
  updateCardUI('card-typing', blockTyping);
  updateCardUI('card-seen', blockSeen);
});

// ─── Event Listeners ──────────────────────────────────────────────────────

toggleEnabled.addEventListener('change', () => {
  const enabled = toggleEnabled.checked;
  chrome.storage.sync.set({ enabled });
  updateMasterUI(enabled);
});

toggleTyping.addEventListener('change', () => {
  const blockTyping = toggleTyping.checked;
  chrome.storage.sync.set({ blockTyping });
  updateCardUI('card-typing', blockTyping);
});

toggleSeen.addEventListener('change', () => {
  const blockSeen = toggleSeen.checked;
  chrome.storage.sync.set({ blockSeen });
  updateCardUI('card-seen', blockSeen);
});

// ─── UI Update Helpers ────────────────────────────────────────────────────

function updateMasterUI(enabled) {
  if (enabled) {
    masterLabel.textContent = 'Đang bật';
    masterLabel.classList.remove('off');
    featuresSection.classList.remove('disabled');
    statusDot.classList.remove('inactive');
    statusText.classList.remove('inactive');
    statusText.textContent = 'Đang hoạt động trên trang này';
    statusBar.classList.remove('inactive');
  } else {
    masterLabel.textContent = 'Đã tắt';
    masterLabel.classList.add('off');
    featuresSection.classList.add('disabled');
    statusDot.classList.add('inactive');
    statusText.classList.add('inactive');
    statusText.textContent = 'Extension đã bị tắt';
    statusBar.classList.add('inactive');
  }
}

function updateCardUI(cardId, active) {
  const card = document.getElementById(cardId);
  if (!card) return;
  if (active) {
    card.classList.add('active');
  } else {
    card.classList.remove('active');
  }
}
