// Messenger Ghost — Background Service Worker
// Ensure default settings exist on install, startup, or unpacked load

function ensureDefaults() {
  chrome.storage.sync.get(['blockTyping', 'blockSeen', 'enabled'], (result) => {
    const updates = {};
    if (result.blockTyping === undefined) updates.blockTyping = true;
    if (result.blockSeen === undefined) updates.blockSeen = true;
    if (result.enabled === undefined) updates.enabled = true;
    if (Object.keys(updates).length > 0) {
      chrome.storage.sync.set(updates);
    }
  });
}

chrome.runtime.onInstalled.addListener(ensureDefaults);
if (chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(ensureDefaults);
}
ensureDefaults();
