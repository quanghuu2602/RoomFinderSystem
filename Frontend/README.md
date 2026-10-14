# Frontend RoomFinder

Frontend HTML, CSS và JavaScript thuần. Đã có biểu mẫu đăng ký, đăng nhập gọi API và trang phòng tạm để kiểm tra email, role và đăng xuất. Danh sách phòng sẽ được bổ sung ở Ngày 8.

## Cấu trúc

```text
Frontend/
├── index.html
├── styles.css                 # CSS chung có sẵn
├── css/
│   ├── index.css              # CSS riêng trang chủ
│   ├── auth/
│   │   ├── login.css          # CSS riêng trang đăng nhập
│   │   └── register.css       # CSS riêng trang đăng ký
│   └── rooms/
│       └── room-list.css      # CSS riêng trang phòng
├── js/
│   ├── config.js              # Địa chỉ API dùng chung
│   ├── ui.js                  # Hàm showMessage dùng chung
│   ├── index.js
│   ├── auth/
│   │   ├── session.js         # Đọc JWT, lưu phiên và đăng xuất
│   │   ├── login.js
│   │   └── register.js
│   └── rooms/
│       └── room-list.js
├── pages/
│   ├── auth/
│   │   ├── login.html
│   │   └── register.html
│   └── rooms/
│       └── room-list.html
└── assets/
    └── images/               # Lưu ảnh frontend
```

## Chạy bằng Live Server

1. Trong VS Code, chọn **File → Open Folder → D:\RoomFinderSystem\Frontend**.
2. Nếu chưa có Live Server, mở Extensions (`Ctrl+Shift+X`) và cài extension **Live Server** của **Ritwick Dey**.
3. Chuột phải `index.html` → **Open with Live Server**.
4. Frontend cần chạy tại `http://127.0.0.1:5500` hoặc `http://localhost:5500` để khớp cấu hình CORS của API. Nếu Live Server dùng cổng khác, mở Settings, tìm **Live Server › Settings: Port**, đặt `5500` và khởi động lại Live Server. Nếu cổng đang bận, dừng phiên Live Server cũ trước.

Khi bắt đầu viết chức năng gọi API, chạy backend trong một terminal khác:

```powershell
dotnet run --project D:\RoomFinderSystem\RoomFinder.API --launch-profile https
```

Giữ backend chạy. Swagger: `https://localhost:7055/swagger`. Địa chỉ API đã đặt trong `js/config.js`.

## Viết từng trang riêng

- Viết nội dung và biểu mẫu trong file `.html` của trang.
- Viết giao diện trong file `.css` tương ứng; các file này đã được liên kết trong HTML.
- Viết xử lý trong file `.js` tương ứng; `config.js` được nạp trước để dùng `API_BASE_URL`.
- `styles.css` giữ CSS chung cho các trang. CSS riêng được nạp sau để tùy chỉnh từng trang.
- Khi thêm trang mới, tạo ba file HTML/CSS/JS tương ứng và liên kết đúng đường dẫn tương đối. Không cần npm hoặc công cụ build cho khung hiện tại.

## Hàm dùng chung cho đăng nhập

Các trang đăng ký và đăng nhập nạp script ở cuối `body` theo thứ tự: `config.js` → `auth/session.js` → `ui.js` → JavaScript riêng của trang. Trang phòng nạp `config.js`, `auth/session.js` rồi `rooms/room-list.js`. Nếu đưa script lên `head`, thêm `defer` và giữ nguyên thứ tự này.

- `parseJwt(token)`: đọc payload của JWT, hỗ trợ nội dung Unicode; ném lỗi nếu token sai định dạng.
- `saveSession(token)`: lưu token, email và role vào `localStorage`; từ chối token hết hạn hoặc thiếu claim `exp`. Token do backend hiện tại tạo đã có `exp`.
- `getToken()`, `getEmail()`, `getRole()`: lấy thông tin đã lưu.
- `isLoggedIn()`: trả về `false` nếu token thiếu, lỗi hoặc hết hạn. Đây chỉ là kiểm tra trạng thái giao diện; API vẫn phải xác thực chữ ký và quyền truy cập.
- `logout()`: xóa thông tin phiên và chuyển đến trang đăng nhập.
- `showMessage(text, type)`: hiện thông báo vào phần tử `id="message"`; `type` là `"error"` hoặc `"success"`. Hai trang đăng nhập và đăng ký đã có phần tử này. Nếu trang không có, hàm bỏ qua.

Ví dụ dùng trong `js/auth/login.js`, sau khi API đăng nhập trả về thành công với đối tượng `data`:

```javascript
try {
    saveSession(data.token);
    showMessage("Đăng nhập thành công!", "success");
} catch {
    showMessage("Không thể lưu phiên đăng nhập. Vui lòng thử lại.", "error");
}
```

## Chạy thử luồng đăng nhập

1. Chạy API với profile `https`, mở `https://localhost:7055/swagger` và bảo đảm trình duyệt tin cậy chứng chỉ localhost. Nếu cần, chạy `dotnet dev-certs https --trust` rồi mở lại trình duyệt.
2. Mở `Frontend` làm gốc Live Server, vào `http://127.0.0.1:5500/pages/auth/register.html` để tạo tài khoản thử. Giữ cùng một hostname (`127.0.0.1` hoặc `localhost`) trong suốt quá trình vì mỗi origin có `localStorage` riêng.
3. Đăng ký thành công sẽ chuyển sang trang đăng nhập. Đăng nhập thành công sẽ chuyển tới `pages/rooms/room-list.html`, hiển thị email và role.
4. Bấm **Đăng xuất** để xóa phiên và về trang đăng nhập. Mở lại trang phòng khi chưa đăng nhập phải được chuyển về trang đăng nhập.

Hàm `logout()` hiện tính đường dẫn từ vị trí file `session.js`, nên vẫn đúng khi Live Server mở cả thư mục `RoomFinderSystem`. Khi đó URL frontend có thêm tiền tố `/Frontend/`.
