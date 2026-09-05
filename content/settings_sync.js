/**
 * Messenger Ghost — Settings Sync
 * Runs in ISOLATED world (document_start).
 *
 * Reads settings from chrome.storage and writes them to
 * document.documentElement.dataset so network_blocker.js
 * (running in MAIN world) can read them synchronously.
 */

'use strict';

let settings = { blockTyping: true, blockSeen: true, blockFloatingVideo: true, enabled: true };

// Inject style shield for blocked floating video
function injectShieldStyle() {
  if (document.getElementById('mg-shield-style')) return;
  const style = document.createElement('style');
  style.id = 'mg-shield-style';
  style.textContent = `
    [data-mg-docked-video="blocked"] {
      display: none !important;
      opacity: 0 !important;
      pointer-events: none !important;
      visibility: hidden !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

if (document.head || document.documentElement) {
  injectShieldStyle();
} else {
  document.addEventListener('DOMContentLoaded', injectShieldStyle, { once: true });
}

function sync() {
  const root = document.documentElement;
  if (root && root.dataset) {
    root.dataset.mgEnabled            = String(settings.enabled);
    root.dataset.mgBlockTyping        = String(settings.blockTyping);
    root.dataset.mgBlockSeen          = String(settings.blockSeen);
    root.dataset.mgBlockFloatingVideo = String(settings.blockFloatingVideo);
  }
  try {
    window.postMessage({
      source: 'messenger-ghost-sync',
      settings: { ...settings }
    }, '*');
  } catch (_) {}
}

// Write defaults immediately
sync();

// Load saved settings from storage
chrome.storage.sync.get(['blockTyping', 'blockSeen', 'blockFloatingVideo', 'enabled'], (result) => {
  if (result) {
    if (result.enabled !== undefined) settings.enabled = Boolean(result.enabled);
    if (result.blockTyping !== undefined) settings.blockTyping = Boolean(result.blockTyping);
    if (result.blockSeen !== undefined) settings.blockSeen = Boolean(result.blockSeen);
    if (result.blockFloatingVideo !== undefined) settings.blockFloatingVideo = Boolean(result.blockFloatingVideo);
  }
  sync();
});

// React to popup toggle changes in real-time
chrome.storage.onChanged.addListener((changes) => {
  if (changes.blockTyping && changes.blockTyping.newValue !== undefined) {
    settings.blockTyping = Boolean(changes.blockTyping.newValue);
  }
  if (changes.blockSeen && changes.blockSeen.newValue !== undefined) {
    settings.blockSeen = Boolean(changes.blockSeen.newValue);
  }
  if (changes.blockFloatingVideo && changes.blockFloatingVideo.newValue !== undefined) {
    settings.blockFloatingVideo = Boolean(changes.blockFloatingVideo.newValue);
  }
  if (changes.enabled && changes.enabled.newValue !== undefined) {
    settings.enabled = Boolean(changes.enabled.newValue);
  }
  sync();
});

