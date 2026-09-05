# Messenger Ghost 👻

**Messenger Ghost** là một tiện ích mở rộng (extension) dành cho trình duyệt Chrome, Edge, Brave, Cốc Cốc,... giúp bạn bảo vệ quyền riêng tư khi sử dụng Facebook và Messenger. 

Extension này chặn các tín hiệu mạng gửi từ trình duyệt của bạn đến máy chủ Facebook, qua đó ngăn người khác biết bạn đã đọc tin nhắn hay đang gõ phím.

---

## ✨ Tính năng nổi bật (Phiên bản v3.2.0)

1. 🛡️ **Chặn thông báo "Đã xem" (Seen / Read Receipt)**
   - Bạn có thể đọc tin nhắn thoải mái mà đối phương sẽ không thấy biểu tượng avatar nhỏ của bạn (đánh dấu đã đọc) hiển thị ở tin nhắn cuối cùng.
   - Tin nhắn của bạn sẽ luôn ở trạng thái "Đã nhận" (Delivered) đối với họ.

2. ⌨️ **Chặn thông báo "Đang gõ" (Typing Indicator)**
   - Ngăn đối phương nhìn thấy biểu tượng dấu 3 chấm (`...`) khi bạn đang gõ phím trả lời.
   - Bạn có thể soạn tin nhắn dài tùy ý, đối phương sẽ chỉ nhận được tin nhắn đột ngột nảy lên khi bạn bấm Gửi.

3. 🚀 **Hoạt động trơn tru, không gây lỗi giao diện (UI)**
   - Sử dụng kỹ thuật **MQTT Payload Mangling** (Làm sai lệch gói tin) thay vì chặn hoàn toàn gói tin để đánh lừa máy chủ Facebook.
   - Hoàn toàn không gây đứt kết nối ngầm, không làm giật lag giao diện, và **không làm mất con trỏ chuột** khi gõ phím (một lỗi rất phổ biến ở các extension chặn typing khác).

---

## 🛠️ Hướng dẫn cài đặt (Chế độ Nhà phát triển)

Do extension này chưa được đưa lên Chrome Web Store, bạn cần cài đặt thủ công thông qua thư mục mã nguồn:

1. **Tải mã nguồn:**
   - Bấm vào nút **Code** màu xanh lá trên GitHub -> chọn **Download ZIP**.
   - Giải nén file ZIP vừa tải về vào một thư mục trên máy tính (ví dụ: `C:\Messenger-Ghost`).

2. **Mở trang Tiện ích mở rộng (Extensions):**
   - Mở Chrome (hoặc Edge, Cốc Cốc).
   - Truy cập vào địa chỉ: `chrome://extensions/` (hoặc `edge://extensions/`).

3. **Bật Chế độ dành cho nhà phát triển (Developer mode):**
   - Nhìn sang góc **trên cùng bên phải**, gạt công tắc **Developer mode** (Chế độ dành cho nhà phát triển) sang màu xanh (Bật).

4. **Tải extension lên:**
   - Bấm vào nút **Load unpacked** (Tải tiện ích đã giải nén) xuất hiện ở góc trên bên trái.
   - Chọn thư mục `Messenger-Ghost` mà bạn vừa giải nén ở bước 1.
   - Extension **Messenger Ghost** sẽ xuất hiện trong danh sách.

---

## 💡 Hướng dẫn sử dụng

1. **Ghim Extension (Khuyên dùng):**
   - Bấm vào biểu tượng mảnh ghép (Extensions) ở góc trên bên phải trình duyệt.
   - Bấm vào biểu tượng đinh ghim (Pin) bên cạnh tên **Messenger Ghost** để nó luôn hiển thị trên thanh công cụ.

2. **Tùy chỉnh tính năng:**
   - Click vào biểu tượng con ma 👻 của extension trên thanh công cụ.
   - Giao diện Popup sẽ hiện ra. Tại đây, bạn có 3 công tắc (switch):
     - **Enable Messenger Ghost:** Công tắc tổng. Tắt cái này sẽ vô hiệu hóa toàn bộ extension.
     - **Block "Seen" (Read Receipts):** Bật để chặn tính năng đã xem.
     - **Block Typing Indicator:** Bật để chặn tính năng đang gõ.
   - Các thay đổi của bạn sẽ tự động được lưu và đồng bộ ngay lập tức với các tab Facebook/Messenger đang mở (không cần tải lại trang).

3. **Hoạt động ở đâu?**
   - Extension tự động hoạt động trên:
     - `https://www.facebook.com/*`
     - `https://www.messenger.com/*`

---

## ⚙️ Dành cho Nhà phát triển (Kỹ thuật)

Dự án này ứng dụng các kỹ thuật chặn mạng (Network Interception) ở cấp độ sâu nhất của trình duyệt:
- **Hook `WebSocket.prototype.send`**: Đánh chặn các gói tin binary (ArrayBuffer/Blob) giao tiếp qua giao thức MQTT/Thrift của hệ thống Facebook Lightspeed.
- **Hook `window.fetch` và `XMLHttpRequest`**: Đánh chặn các lời gọi API GraphQL Mutation truyền thống (như `MarkReadMutation`, `TypingMutation`).
- **Payload Mangling**: Thay vì drop (chặn) gói tin WebSocket, extension tìm và ghi đè các bytes (ví dụ: `set_typing_state` -> `set_typ_ignored!`) nhằm giữ nguyên độ dài gói tin, giữ trạng thái máy khách đồng bộ và tránh lỗi React UI.

---

## ⚠️ Lưu ý

- **Xung đột:** Nếu bạn đang cài các extension khác có tính năng tương tự (như J2TEAM Security, Unseen,...), chúng có thể xung đột với nhau. Khuyên dùng chỉ bật 1 extension loại này tại một thời điểm.
- **Cập nhật Facebook:** Facebook thường xuyên thay đổi cơ chế nội bộ (nhất là GraphQL hoặc MQTT topic). Nếu tính năng ngừng hoạt động trong tương lai, extension sẽ cần được cập nhật bộ từ khóa (Keyword list).
