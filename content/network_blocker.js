/**
 * Messenger Ghost — Network Blocker v3.2
 * Runs in MAIN world (document_start) so it can override native APIs
 * before Facebook's JavaScript initializes.
 *
 * OUTBOUND ONLY:
 * Blocks outgoing signals that tell Facebook:
 *   1. You are typing   → others won't see typing indicator ("...")
 *   2. You read a msg   → others won't see seen / read receipts (avatar mark)
 *
 * Incoming messages and normal message sending are fully preserved.
 *
 * KEY FIX (v3.1): Facebook routes MQTT traffic (including typing) through a
 * SharedWorker, which runs its own WebSocket outside the main thread.
 * We disable SharedWorker at document_start so Facebook falls back to a
 * main-thread WebSocket that our hooks CAN intercept.
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // 0. DISABLE SharedWorker — CRITICAL FOR TYPING BLOCKING
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Facebook creates a SharedWorker that opens the MQTT WebSocket internally.
  // Since content scripts cannot inject code INTO a SharedWorker, our
  // WebSocket.prototype.send hook on the main thread never sees MQTT packets.
  //
  // By making SharedWorker unavailable BEFORE Facebook's JS loads, Facebook
  // gracefully falls back to opening the WebSocket directly on the main thread,
  // where our prototype hook intercepts every frame.
  //
  // This is safe because:
  //  - Facebook has a built-in fallback (used in Incognito / unsupported browsers)
  //  - The only cost is slightly more memory if multiple tabs are open

  const _SharedWorker = window.SharedWorker;
  try {
    Object.defineProperty(window, 'SharedWorker', {
      value: undefined,
      writable: false,
      configurable: true,
    });
  } catch (_) {
    try { window.SharedWorker = undefined; } catch (__) { }
  }

  // ─── Settings State ─────────────────────────────────────────────────────────

  const localSettings = {
    enabled: true,
    blockTyping: true,
    blockSeen: true,
    blockFloatingVideo: true,
  };

  function readDatasetSettings() {
    const ds = document.documentElement ? document.documentElement.dataset : null;
    if (!ds) return;
    if (ds.mgEnabled !== undefined) localSettings.enabled = ds.mgEnabled !== 'false';
    if (ds.mgBlockTyping !== undefined) localSettings.blockTyping = ds.mgBlockTyping !== 'false';
    if (ds.mgBlockSeen !== undefined) localSettings.blockSeen = ds.mgBlockSeen !== 'false';
    if (ds.mgBlockFloatingVideo !== undefined) localSettings.blockFloatingVideo = ds.mgBlockFloatingVideo !== 'false';
  }

  readDatasetSettings();

  window.addEventListener('message', (event) => {
    if (event && event.data && event.data.source === 'messenger-ghost-sync') {
      const s = event.data.settings;
      if (s) {
        if (s.enabled !== undefined) localSettings.enabled = Boolean(s.enabled);
        if (s.blockTyping !== undefined) localSettings.blockTyping = Boolean(s.blockTyping);
        if (s.blockSeen !== undefined) localSettings.blockSeen = Boolean(s.blockSeen);
        if (s.blockFloatingVideo !== undefined) localSettings.blockFloatingVideo = Boolean(s.blockFloatingVideo);
      }
    }
  });

  const mg = {
    enabled: () => { readDatasetSettings(); return localSettings.enabled; },
    blockTyping: () => { readDatasetSettings(); return localSettings.enabled && localSettings.blockTyping; },
    blockSeen: () => { readDatasetSettings(); return localSettings.enabled && localSettings.blockSeen; },
    blockFloatingVideo: () => { readDatasetSettings(); return localSettings.enabled && localSettings.blockFloatingVideo; },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 0.1 TRAP Facebook Module System (window.__d) — LAYER 1: SOURCE INTERCEPTION
  // ═══════════════════════════════════════════════════════════════════════════
  // Facebook defines React components and hooks via window.__d(name, deps, factory).
  // Neutralize Watch and Scroll modules before they ever register or render.

  let _realD = window.__d;

  function wrapD(fn) {
    if (typeof fn !== 'function') return fn;
    return function (name, deps, factory) {
      if (typeof name === 'string') {
        if (name === 'useWatchAndScrollTrigger') {
          const origFactory = factory;
          factory = function () {
            origFactory.apply(this, arguments);
            const exportBag = arguments[arguments.length - 1];
            if (exportBag && typeof exportBag === 'object') {
              const origHook = exportBag.useWatchAndScrollTrigger;
              exportBag.useWatchAndScrollTrigger = function () {
                if (mg.blockFloatingVideo()) {
                  console.debug('[Messenger Ghost] 🛡️ Neutralized useWatchAndScrollTrigger');
                  return function () {};
                }
                return typeof origHook === 'function' ? origHook.apply(this, arguments) : origHook;
              };
            }
          };
        } else if (name === 'CometWatchAndScroll.react') {
          const origFactory = factory;
          factory = function () {
            origFactory.apply(this, arguments);
            const exportBag = arguments[arguments.length - 1];
            if (exportBag && typeof exportBag === 'object') {
              const origComp = exportBag.default;
              exportBag.default = function () {
                if (mg.blockFloatingVideo()) {
                  console.debug('[Messenger Ghost] 🛡️ Blocked CometWatchAndScroll render');
                  return null;
                }
                return typeof origComp === 'function' ? origComp.apply(this, arguments) : origComp;
              };
            }
          };
        } else if (name === 'CometSetWatchAndScrollVideoContext') {
          const origFactory = factory;
          factory = function () {
            origFactory.apply(this, arguments);
            const exportBag = arguments[arguments.length - 1];
            if (exportBag && typeof exportBag === 'object') {
              const origSetter = exportBag.default || exportBag.CometSetWatchAndScrollVideoContext;
              const noop = function () {
                if (mg.blockFloatingVideo()) {
                  return function () {};
                }
                return typeof origSetter === 'function' ? origSetter.apply(this, arguments) : origSetter;
              };
              if (exportBag.default) exportBag.default = noop;
              if (exportBag.CometSetWatchAndScrollVideoContext) exportBag.CometSetWatchAndScrollVideoContext = noop;
            }
          };
        }
      }
      return fn.apply(this, arguments);
    };
  }

  try {
    Object.defineProperty(window, '__d', {
      configurable: true,
      enumerable: true,
      get: function () { return _realD; },
      set: function (fn) {
        _realD = wrapD(fn);
      },
    });
    if (_realD) {
      _realD = wrapD(_realD);
    }
  } catch (_) {}

  // ─── Keyword Lists & Mangles ────────────────────────────────────────────────

  const SEEN_KEYWORDS = [
    'change_read_status',
    'change_read_status.php',
    'mark_read',
    'mark_thread_read',
    'thread_mark_read',
    'mark_folder_seen',
    'MarkReadMutation',
    'UseMarkThreadsAsReadMutation',
    'markThreadsRead',
    'markThreadRead',
    'markAsRead',
    'threading_mark_as_read',
    'ReadReceiptMutation',
    'readReceiptMutation',
    'MarkAsReadMutation',
    'ThreadMarkAsReadMutation',
    'MessengerMarkReadMutation',
    'MWChatMarkThreadReadMutation',
    'useMarkThreadReadMutation',
    'useMarkFolderAsReadMutation',
    'useMarkThreadAsReadMutation',
    'MarkThreadReadMutation',
    'send_read_receipt',
    'send_delivery_receipt',
    'ephemeral_read_receipt',
    'update_delivery_receipt',
    'delivery_receipt',
    'read_receipt',
    'read_watermark',
    'mark_read_watermark',
    'threads_mark_read',
    'last_read_watermark_ts',
    'read_status',
    'watermark',
    'mark_seen',
    '/mark_thread_read',
    'useMessengerMarkRead',
    'useMessengerThreadMarkRead',
  ];

  const TYPING_KEYWORDS = [
    // Legacy HTTP endpoints
    'typ.php',
    'messaging/typ',
    // GraphQL mutations (specific enough to avoid false positives)
    'setTypingStatus',
    'TypingMutation',
    'TypingIndicatorMutation',
    'StartTypingMutation',
    'StopTypingMutation',
    'MessengerTypingMutation',
    'useSetTypingStatusMutation',
    'useMWChatSetTypingStatusMutation',
    'MWChatTypingStatusMutation',
    'MWTypingStatusMutation',
    'setTyping',
    // MQTT topic strings (appear in binary WS frames when decoded)
    '/orca_typing_notifications',
    '/t_st',
    '/typing_indicator',
    '/chat_typing',
    // Lightspeed task labels / field names
    'set_typing_state',
    'typing_state',
    'typing_status',
    'is_typing',
    // JSON-encoded field patterns inside binary MQTT payloads
    '"is_typing"',
    '"chat_typing"',
    '"setTypingStatus"',
    '"typing_state"',
  ];

  // ─── Payload Mangling ───────────────────────────────────────────────────────
  // Dropping WebSocket frames breaks the multiplexed MQTT stream, causing
  // Facebook's UI state to reset (which makes the text caret disappear).
  // Instead, we MANGLE the payload by replacing keywords with dummy strings
  // of the EXACT SAME LENGTH. This neutralizes the action on the server
  // without breaking the connection.

  const TYPING_MANGLES = [
    { from: 'set_typing_state', to: 'set_typ_ignored!' },
    { from: 'typing_status', to: 'typing_ignore' },
    { from: 'is_typing', to: 'no_typing' },
    { from: 'chat_typing', to: 'chat_ignore' }
  ];

  const SEEN_MANGLES = [
    { from: 'mark_thread_read', to: 'mark_thread_noop' },
    { from: 'change_read_status', to: 'change_noop_status' },
    { from: 'threads_mark_read', to: 'threads_mark_noop' },
    { from: 'read_watermark', to: 'noop_watermark' },
    { from: 'read_receipt', to: 'noop_receipt' }
  ];

  const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

  function mangleString(str, mangles) {
    let result = str;
    for (let i = 0; i < mangles.length; i++) {
      result = result.split(mangles[i].from).join(mangles[i].to);
    }
    return result;
  }

  function mangleBuffer(buffer, mangles) {
    if (!textEncoder) return buffer;

    let view;
    if (buffer instanceof ArrayBuffer) {
      view = new Uint8Array(buffer.slice(0));
    } else {
      view = new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    }

    let modified = false;
    for (let m = 0; m < mangles.length; m++) {
      let fromBytes = textEncoder.encode(mangles[m].from);
      let toBytes = textEncoder.encode(mangles[m].to);
      if (fromBytes.length !== toBytes.length) continue;

      for (let i = 0; i <= view.length - fromBytes.length; i++) {
        let match = true;
        for (let j = 0; j < fromBytes.length; j++) {
          if (view[i + j] !== fromBytes[j]) { match = false; break; }
        }
        if (match) {
          for (let j = 0; j < toBytes.length; j++) {
            view[i + j] = toBytes[j];
          }
          modified = true;
          i += fromBytes.length - 1;
        }
      }
    }
    return modified ? (buffer instanceof ArrayBuffer ? view.buffer : view) : buffer;
  }

  function applyMangle(data, blockTyping, blockSeen) {
    let mangles = [];
    if (blockTyping) mangles = mangles.concat(TYPING_MANGLES);
    if (blockSeen) mangles = mangles.concat(SEEN_MANGLES);
    if (mangles.length === 0) return data;

    if (typeof data === 'string') {
      return mangleString(data, mangles);
    } else if (data instanceof ArrayBuffer || (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(data))) {
      return mangleBuffer(data, mangles);
    }
    return data;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function hasKeyword(str, keywords) {
    if (!str || str.length === 0) return false;
    return keywords.some(kw => str.includes(kw));
  }

  function isMessengerUrl(url) {
    if (!url || typeof url !== 'string') return true;
    return (
      url.includes('facebook.com') ||
      url.includes('messenger.com') ||
      url.includes('edge-chat') ||
      url.includes('edge-mqtt')
    );
  }

  /**
   * Decode binary data (ArrayBuffer, Uint8Array, DataView, etc.) to UTF-8 string.
   */
  function decodeBinary(data) {
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(data);
    } catch (_) {
      return '';
    }
  }

  /**
   * Recursively serialize any value into a searchable string.
   * Handles nested objects with binary ArrayBuffer / Uint8Array values
   * that JSON.stringify would lose.
   */
  function deepToString(body, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 4 || !body) return '';
    if (typeof body === 'string') return body;
    if (typeof body === 'number' || typeof body === 'boolean') return '';

    // Binary buffers
    if (body instanceof ArrayBuffer) return decodeBinary(body);
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(body)) return decodeBinary(body);

    if (typeof body !== 'object') return String(body);

    // URLSearchParams
    if (body instanceof URLSearchParams) return body.toString();

    // FormData
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      var out = '';
      try {
        for (var pair of body.entries()) {
          out += pair[0] + '=' + (typeof pair[1] === 'string' ? pair[1] : '') + '&';
        }
      } catch (_) { }
      return out;
    }

    // Generic object / array: walk properties and decode any nested binaries
    var parts = [];
    try {
      var keys = Object.keys(body);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        parts.push(k);
        var v = body[k];
        if (v != null) {
          parts.push(deepToString(v, depth + 1));
        }
      }
    } catch (_) {
      // Fallback to JSON.stringify
      try { parts.push(JSON.stringify(body)); } catch (__) { }
    }
    return parts.join(' ');
  }

  /**
   * Convert any body type to a searchable string.
   */
  function bodyToString(body) {
    return deepToString(body, 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Intercept WebSocket.prototype.send (PRIMARY interceptor for MQTT)
  // ═══════════════════════════════════════════════════════════════════════════

  const _origWsSend = WebSocket.prototype.send;
  const _WebSocket = window.WebSocket;

  WebSocket.prototype.send = function (data) {
    if (!mg.enabled()) return _origWsSend.apply(this, arguments);

    // Mangle payload INSTEAD of dropping it.
    // Dropping frames breaks the MQTT connection and glitches the UI (text caret vanishes).
    let isTyping = mg.blockTyping();
    let isSeen = mg.blockSeen();

    if (isTyping || isSeen) {
      if (typeof Blob !== 'undefined' && data instanceof Blob) {
        // Blob handling (async)
        var ws = this;
        data.arrayBuffer().then(function (buffer) {
          var str = decodeBinary(buffer);
          if (str) {
            if (isTyping && hasKeyword(str, TYPING_KEYWORDS)) {
              console.debug('[Messenger Ghost] 🛡️ Mangled outgoing typing (WebSocket/Blob)');
            } else if (isSeen && hasKeyword(str, SEEN_KEYWORDS)) {
              console.debug('[Messenger Ghost] 🛡️ Mangled outgoing read-receipt (WebSocket/Blob)');
            }
          }
          let mangledBuffer = applyMangle(buffer, isTyping, isSeen);
          _origWsSend.call(ws, mangledBuffer);
        }).catch(function () {
          _origWsSend.call(ws, data);
        });
        return;
      }

      // Synchronous handling for string/ArrayBuffer
      var str = '';
      try {
        if (typeof data === 'string') {
          str = data;
        } else if (data instanceof ArrayBuffer || (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(data))) {
          str = decodeBinary(data);
        }
      } catch (_) { }

      if (str) {
        if (isTyping && hasKeyword(str, TYPING_KEYWORDS)) {
          console.debug('[Messenger Ghost] 🛡️ Mangled outgoing typing (WebSocket)');
        } else if (isSeen && hasKeyword(str, SEEN_KEYWORDS)) {
          console.debug('[Messenger Ghost] 🛡️ Mangled outgoing read-receipt (WebSocket)');
        }
      }

      data = applyMangle(data, isTyping, isSeen);
    }

    return _origWsSend.call(this, data);
  };

  // Patch constructor to preserve prototypes and instanceof checks
  function GhostWebSocket(url, protocols) {
    var ws = protocols !== undefined
      ? new _WebSocket(url, protocols)
      : new _WebSocket(url);
    try { ws._mgUrl = String(url || ''); } catch (_) { }
    return ws;
  }

  GhostWebSocket.prototype = _WebSocket.prototype;
  GhostWebSocket.CONNECTING = _WebSocket.CONNECTING;
  GhostWebSocket.OPEN = _WebSocket.OPEN;
  GhostWebSocket.CLOSING = _WebSocket.CLOSING;
  GhostWebSocket.CLOSED = _WebSocket.CLOSED;
  Object.setPrototypeOf(GhostWebSocket, _WebSocket);
  window.WebSocket = GhostWebSocket;

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTE: MessagePort & Worker interception REMOVED in v3.2.
  // SharedWorker is already disabled (step 0), so MQTT traffic now flows
  // through main-thread WebSocket where step 1 catches it.
  // Intercepting MessagePort/Worker caused UI side-effects (cursor issues)
  // because Facebook uses postMessage for internal React/UI communication.
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Intercept fetch()
  // ═══════════════════════════════════════════════════════════════════════════

  const _fetch = window.fetch;

  window.fetch = function (input, init) {
    if (!mg.enabled()) return _fetch.apply(this, arguments);

    var url = '';
    if (typeof input === 'string') {
      url = input;
    } else if (input && typeof input.url === 'string') {
      url = input.url;
    }

    if (isMessengerUrl(url)) {
      var bodyStr = bodyToString(init && init.body);
      var target = url + ' ' + bodyStr;

      if (mg.blockSeen() && hasKeyword(target, SEEN_KEYWORDS)) {
        console.debug('[Messenger Ghost] 🛡️ Blocked outgoing read-receipt (fetch)');
        return Promise.resolve(new Response('{"data":{}}', {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (mg.blockTyping() && hasKeyword(target, TYPING_KEYWORDS)) {
        console.debug('[Messenger Ghost] 🛡️ Blocked outgoing typing (fetch)');
        return Promise.resolve(new Response('{"data":{}}', {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }));
      }
    }

    return _fetch.apply(this, arguments);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Intercept XMLHttpRequest
  // ═══════════════════════════════════════════════════════════════════════════

  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._mgUrl = String(url || '');
    return _xhrOpen.apply(this, arguments);
  };

  function fakeXhrSuccess(xhr) {
    setTimeout(function () {
      try {
        Object.defineProperty(xhr, 'readyState', { get: function () { return 4; }, configurable: true });
        Object.defineProperty(xhr, 'status', { get: function () { return 200; }, configurable: true });
        Object.defineProperty(xhr, 'responseText', { get: function () { return '{"data":{}}'; }, configurable: true });
        xhr.dispatchEvent(new ProgressEvent('readystatechange'));
        xhr.dispatchEvent(new ProgressEvent('load'));
      } catch (_) { }
    }, 0);
  }

  XMLHttpRequest.prototype.send = function (body) {
    if (!mg.enabled()) return _xhrSend.apply(this, arguments);

    var url = this._mgUrl || '';
    if (isMessengerUrl(url)) {
      var bodyStr = bodyToString(body);
      var target = url + ' ' + bodyStr;

      if (mg.blockSeen() && hasKeyword(target, SEEN_KEYWORDS)) {
        console.debug('[Messenger Ghost] 🛡️ Blocked outgoing read-receipt (XHR)');
        fakeXhrSuccess(this);
        return;
      }

      if (mg.blockTyping() && hasKeyword(target, TYPING_KEYWORDS)) {
        console.debug('[Messenger Ghost] 🛡️ Blocked outgoing typing (XHR)');
        fakeXhrSuccess(this);
        return;
      }
    }

    return _xhrSend.apply(this, arguments);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Intercept navigator.sendBeacon()
  // ═══════════════════════════════════════════════════════════════════════════

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    var _sendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      if (!mg.enabled()) return _sendBeacon(url, data);

      var urlStr = String(url || '');
      if (isMessengerUrl(urlStr)) {
        var bodyStr = bodyToString(data);
        var target = urlStr + ' ' + bodyStr;

        if (mg.blockSeen() && hasKeyword(target, SEEN_KEYWORDS)) {
          console.debug('[Messenger Ghost] 🛡️ Blocked outgoing read-receipt (sendBeacon)');
          return true;
        }
        if (mg.blockTyping() && hasKeyword(target, TYPING_KEYWORDS)) {
          console.debug('[Messenger Ghost] 🛡️ Blocked outgoing typing (sendBeacon)');
          return true;
        }
      }
      return _sendBeacon(url, data);
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. FLOATING VIDEO (WATCH & SCROLL) HEURISTIC OBSERVER & AUTO-CLOSER
  // ═══════════════════════════════════════════════════════════════════════════
  // Provides defense-in-depth: if Facebook renames modules or bypasses __d hook,
  // this observer detects floating video containers by geometric heuristics,
  // pauses and mutes playback (stopping audio leaks), applies instant CSS
  // concealment, and triggers the close button to unmount React state cleanly.

  const DOCKED_CLOSE_REGEX = /(đóng|close|schließen|fermer|cerrar|chiudi|fechar|dismiss)/i;

  function findFloatingVideoContainer(videoEl) {
    if (!videoEl || !videoEl.isConnected) return null;

    let curr = videoEl.parentElement;
    let fixedAncestor = null;

    while (curr && curr !== document.body && curr !== document.documentElement) {
      // Ignore Messenger chat tabs / message composer dialogs
      if (curr.querySelector && (curr.querySelector('[role="textbox"]') || curr.querySelector('[contenteditable="true"]'))) {
        return null;
      }
      if (curr.getAttribute && (curr.getAttribute('role') === 'dialog' || curr.getAttribute('data-pagelet') === 'ChatTab')) {
        if (curr.querySelector('[role="textbox"]') || curr.querySelector('[contenteditable="true"]')) {
          return null;
        }
      }

      const style = window.getComputedStyle(curr);
      if (style.position === 'fixed' || style.position === 'sticky') {
        fixedAncestor = curr;
        break;
      }
      curr = curr.parentElement;
    }

    if (!fixedAncestor) return null;

    const rect = fixedAncestor.getBoundingClientRect();
    const winW = window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 1280);
    const winH = window.innerHeight || (document.documentElement ? document.documentElement.clientHeight : 800);

    // Mini-player geometric signature: bottom half, reasonable mini-dimensions, not fullscreen
    const inBottomArea = rect.bottom > winH * 0.4 && rect.top > 40;
    const isMiniSize = rect.width > 80 && rect.width < 550 && rect.height > 60 && rect.height < 450;
    const notFullscreen = rect.width < winW * 0.8 && rect.height < winH * 0.8;

    if (inBottomArea && isMiniSize && notFullscreen) {
      return fixedAncestor;
    }
    return null;
  }

  function blockAndCloseFloatingPlayer(container, videoEl) {
    if (!container || container.dataset.mgDockedVideo === 'blocked') return;
    container.dataset.mgDockedVideo = 'blocked';

    // 1. Conceal immediately
    container.style.setProperty('display', 'none', 'important');
    container.style.setProperty('opacity', '0', 'important');
    container.style.setProperty('pointer-events', 'none', 'important');
    container.style.setProperty('visibility', 'hidden', 'important');

    // 2. Pause & mute video to stop sound leakage
    try {
      if (videoEl) {
        videoEl.pause();
        videoEl.muted = true;
      }
      const allVids = container.querySelectorAll('video');
      for (let i = 0; i < allVids.length; i++) {
        try {
          allVids[i].pause();
          allVids[i].muted = true;
        } catch (_) {}
      }
    } catch (_) {}

    // 3. Trigger close button to cleanly unmount React tree
    try {
      const buttons = container.querySelectorAll('div[role="button"], button');
      let clicked = false;
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        const label = btn.getAttribute('aria-label') || btn.textContent || '';
        if (DOCKED_CLOSE_REGEX.test(label)) {
          btn.click();
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        for (let i = 0; i < buttons.length; i++) {
          const btn = buttons[i];
          if (btn.querySelector('svg')) {
            const bRect = btn.getBoundingClientRect();
            const cRect = container.getBoundingClientRect();
            if (bRect.top <= cRect.top + 60) {
              btn.click();
              clicked = true;
              break;
            }
          }
        }
      }
    } catch (_) {}

    console.debug('[Messenger Ghost] 🛡️ Neutralized floating video mini-player');
  }

  function scanForFloatingVideos() {
    if (!mg.blockFloatingVideo()) return;
    const videos = document.querySelectorAll('video');
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const container = findFloatingVideoContainer(v);
      if (container) {
        blockAndCloseFloatingPlayer(container, v);
      }
    }
  }

  let _scanTimer = null;
  function scheduleScan() {
    if (!mg.blockFloatingVideo() || _scanTimer) return;
    _scanTimer = setTimeout(() => {
      _scanTimer = null;
      scanForFloatingVideos();
    }, 100);
  }

  // MutationObserver for newly injected floating player containers
  const floatingVideoObserver = new MutationObserver((mutations) => {
    if (!mg.blockFloatingVideo()) return;
    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];
      if (m.addedNodes && m.addedNodes.length > 0) {
        for (let j = 0; j < m.addedNodes.length; j++) {
          const node = m.addedNodes[j];
          if (node.nodeType === 1) {
            if (node.tagName === 'VIDEO' || (node.querySelector && node.querySelector('video'))) {
              scheduleScan();
              return;
            }
          }
        }
      }
    }
  });

  function initFloatingVideoShield() {
    const target = document.body || document.documentElement;
    if (target) {
      floatingVideoObserver.observe(target, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        const root = document.body || document.documentElement;
        if (root) floatingVideoObserver.observe(root, { childList: true, subtree: true });
      }, { once: true });
    }

    // Also listen to scroll (throttled) because Facebook triggers miniplayer docking on scroll
    window.addEventListener('scroll', scheduleScan, { passive: true });
  }

  initFloatingVideoShield();

  console.info('[Messenger Ghost] 👻 v3.3.0 Active — SharedWorker disabled, Watch & Scroll blocked, MQTT traffic intercepted.');

})();
