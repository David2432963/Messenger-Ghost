/**
 * Messenger Ghost — Settings Sync
 * Runs in ISOLATED world (document_start).
 *
 * Reads settings from chrome.storage and writes them to
 * document.documentElement.dataset so network_blocker.js
 * (running in MAIN world) can read them synchronously.
 */

'use strict';

let settings = { blockTyping: true, blockSeen: true, enabled: true };

function sync() {
  const root = document.documentElement;
  if (root && root.dataset) {
    root.dataset.mgEnabled     = String(settings.enabled);
    root.dataset.mgBlockTyping = String(settings.blockTyping);
    root.dataset.mgBlockSeen   = String(settings.blockSeen);
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
chrome.storage.sync.get(['blockTyping', 'blockSeen', 'enabled'], (result) => {
  if (result) {
    if (result.enabled !== undefined) settings.enabled = Boolean(result.enabled);
    if (result.blockTyping !== undefined) settings.blockTyping = Boolean(result.blockTyping);
    if (result.blockSeen !== undefined) settings.blockSeen = Boolean(result.blockSeen);
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
  if (changes.enabled && changes.enabled.newValue !== undefined) {
    settings.enabled = Boolean(changes.enabled.newValue);
  }
  sync();
});

