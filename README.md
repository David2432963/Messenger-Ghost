# Messenger Ghost 👻

**Messenger Ghost** is a browser extension for Chrome, Edge, Brave, and other Chromium-based browsers that helps you protect your privacy while using Facebook and Messenger.

This extension intercepts network signals sent from your browser to Facebook's servers, preventing others from knowing when you have read their messages or when you are typing a reply.

---

## ✨ Key Features (v3.3.0)

1. 🛡️ **Block "Seen" (Read Receipts)**
   - You can read messages freely without the sender seeing your small avatar icon (the read receipt) at the bottom of the conversation.
   - To them, the message will always remain in the "Delivered" state.

2. ⌨️ **Block Typing Indicator**
   - Prevents the sender from seeing the three-dot typing indicator (`...`) while you are drafting a reply.
   - You can take your time to compose long messages; the sender will only receive the message instantly when you click Send.

3. 🎬 **Block Floating Video (Watch & Scroll Mini-Player)**
   - Automatically stops Facebook from popping up the annoying floating video mini-player at the bottom-right corner when scrolling past playing videos, livestreams, or Reels.
   - Built with a **Triple-Shield Defense**:
     - *Layer 1*: Intercepts Facebook's React modules (`useWatchAndScrollTrigger`, `CometWatchAndScroll.react`) before they render.
     - *Layer 2*: Heuristic DOM observer detects floating video containers by position and geometry, immediately pauses/mutes audio leaks, and clicks the React close button to cleanly unmount state.
     - *Layer 3*: Dynamic CSS shield instantly suppresses visual flickering.

4. 🚀 **Smooth Operation without UI Bugs**
   - Uses an advanced **MQTT Payload Mangling** technique instead of outright blocking WebSocket frames.
   - This prevents background connection drops, avoids UI lag, and **fixes the disappearing text cursor bug** (a common issue in other typing-blocker extensions).

---

## 🛠️ Installation Guide (Developer Mode)

Since this extension is not yet published on the Chrome Web Store, you will need to install it manually using the source code:

1. **Download the source code:**
   - Click the green **Code** button on GitHub -> select **Download ZIP**.
   - Extract the downloaded ZIP file to a folder on your computer (e.g., `C:\Messenger-Ghost`).

2. **Open the Extensions page:**
   - Open Chrome (or Edge, Brave).
   - Navigate to: `chrome://extensions/` (or `edge://extensions/`).

3. **Enable Developer mode:**
   - Look at the **top right corner** and toggle the **Developer mode** switch to ON.

4. **Load the extension:**
   - Click the **Load unpacked** button that appears in the top left corner.
   - Select the `Messenger-Ghost` folder you extracted in step 1.
   - **Messenger Ghost** will now appear in your list of extensions.

---

## 💡 How to Use

1. **Pin the Extension (Recommended):**
   - Click the puzzle piece icon (Extensions) in the top right corner of your browser.
   - Click the pin icon next to **Messenger Ghost** to keep it visible on your toolbar.

2. **Customize Features:**
   - Click the ghost icon 👻 on your toolbar to open the Popup interface.
   - You will see switches to control each feature:
     - **Enable Messenger Ghost:** Master switch. Turning this off disables the entire extension.
     - **Ẩn "Đang gõ..." (Block Typing Indicator):** Turn on to block the typing indicator.
     - **Ẩn "Đã xem" (Block Read Receipts):** Turn on to block read receipts.
     - **Chặn video thu nhỏ (Block Floating Video):** Turn on to prevent floating video mini-players from popping up when scrolling past posts.
   - Your settings are saved automatically and synchronized instantly across all open Facebook/Messenger tabs (no page reload required).

3. **Where does it work?**
   - The extension automatically runs on:
     - `https://www.facebook.com/*`
     - `https://www.messenger.com/*`

---

## ⚙️ For Developers (Technical Details)

This project utilizes deep network interception and runtime hooking techniques:
- **`WebSocket.prototype.send` Hook**: Intercepts binary packets (ArrayBuffer/Blob) communicated via the MQTT/Thrift protocol used by Facebook's Lightspeed architecture.
- **`window.fetch` and `XMLHttpRequest` Hook**: Intercepts traditional GraphQL Mutation API calls (such as `MarkReadMutation`, `TypingMutation`).
- **Payload Mangling**: Instead of dropping WebSocket packets (which breaks the MQTT protocol sequence and causes the React UI to reset/lose the text caret), the extension searches for and overwrites specific bytes (e.g., changing `set_typing_state` to `set_typ_ignored!`). This maintains the exact packet length, keeps the client state synchronized, and neutralizes the action on the server.
- **Facebook Module Interception (`window.__d` Trap)**: Traps Facebook's CommonJS module system before runtime execution to neutralize `useWatchAndScrollTrigger`, `CometWatchAndScroll.react`, and `CometSetWatchAndScrollVideoContext`.
- **Heuristic DOM MutationObserver**: Monitors DOM mutations for fixed-position video containers in bottom-right viewports, muting/pausing video elements and triggering localized React close handlers.

---

## ⚠️ Important Notes

- **Conflicts:** If you have other extensions with similar features (like J2TEAM Security, Unseen, etc.), they might conflict. It is highly recommended to enable only one extension of this type at a time.
- **Facebook Updates:** Facebook frequently updates its internal mechanisms (especially GraphQL mutations or MQTT topics). If the features stop working in the future, the extension's Keyword list will need to be updated.
