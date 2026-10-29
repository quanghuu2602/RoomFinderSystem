# RoomFinder — Website cho thuê của công ty

Frontend HTML, CSS và JavaScript thuần, không cần npm hoặc build.

## Mô hình công ty và trang quản trị

- **Admin** là nhân viên quản trị của công ty, có quyền thêm/sửa/xóa tất cả phòng, cập nhật tình trạng và tải/xóa ảnh.
- **Customer** là khách hàng. Đăng ký công khai luôn tạo Customer; gửi thêm trường `role` cũng không thể tự cấp quyền Admin.
- Khách chưa đăng nhập vẫn xem phòng và ảnh công khai. Không còn đăng ký tài khoản chủ trọ.
- Tài khoản Student/Landlord cũ đăng nhập sẽ nhận quyền Customer; không được quản lý phòng. JWT cũng được đối chiếu vai trò hiện tại trong database.
- Giữ cột `LandlordId` cũ để tương thích database; đối với phòng mới cột này lưu ID admin tạo phòng. Thay đổi này không cần migration mới ngoài migration District của phần 8A.

Trang quản trị: `http://127.0.0.1:5500/pages/admin/dashboard.html`.
Nếu Live Server mở từ thư mục gốc dự án, thêm `/Frontend` trước `/pages`.

Đăng nhập bằng tài khoản Admin rồi chọn **Quản trị** trên thanh điều hướng. Khi mở trang đăng nhập trực tiếp, admin đăng nhập thành công sẽ vào trang quản trị; nếu đang xem một phòng thì vẫn quay lại phòng đó.

### Tạo tài khoản admin nội bộ

Từ thư mục `D:\RoomFinderSystem`, chạy trong terminal tương tác:

```powershell
dotnet run --project RoomFinder.API -- --create-admin
```

Nhập email mới, họ tên, mật khẩu và xác nhận mật khẩu. Mật khẩu không hiện trên màn hình. Công cụ tạo Admin qua ASP.NET Identity và thoát, không mở web server. Database phải sẵn sàng và đã áp dụng migration. Không có tài khoản/mật khẩu admin mặc định; công cụ không tự nâng quyền tài khoản đã tồn tại. Chưa chạy lệnh này trên database thật trong quá trình triển khai.

### Đăng phòng và ảnh lên website

1. Vào trang quản trị, chọn **Thêm phòng mới**.
2. Điền tên phòng/căn hộ, địa chỉ, khu vực, diện tích, giá thuê và tình trạng.
3. Chọn ảnh trực tiếp từ máy; có xem trước và bỏ ảnh trước khi tải. Nhận JPG/JPEG, PNG, WebP, tối đa 5 MB/ảnh và 10 ảnh mỗi lần tải. Backend kiểm tra cả dấu hiệu định dạng file.
4. Bấm **Lưu phòng**. Phòng và ảnh được lưu vào API, hiển thị khi tải trang công khai. Trang chủ hiển thị ba phòng mới nhất; ảnh đầu tiên của mỗi phòng là ảnh đại diện. Hình minh họa lớn ở đầu trang chủ vẫn là tài nguyên trang trí riêng.
5. Chọn **Sửa & ảnh** để sửa thông tin, thêm hoặc xóa ảnh. Xóa ảnh đại diện để ảnh tiếp theo thay thế. Khách xem được các ảnh trong hộp thoại thông tin phòng.
6. Có nút đổi tình trạng còn trống/đã thuê, tìm phòng trong danh sách và xóa phòng kèm ảnh. Xóa cần xác nhận trên giao diện.

Nếu thông tin đã lưu nhưng tải ảnh lỗi, trang quản trị giữ ID phòng và ảnh đang chọn để thử lại, không tạo lại phòng. Ảnh lưu ở `RoomFinder.API/wwwroot/uploads`; cần lưu giữ thư mục này khi sao lưu hoặc triển khai ứng dụng.

API ghi phòng và ảnh yêu cầu quyền Admin ở backend. Trang quản trị xác minh tài khoản qua `/api/auth/me`, không chỉ kiểm tra `localStorage`.

## Mở giao diện

1. Mở thư mục `D:\RoomFinderSystem\Frontend` trong VS Code.
2. Chuột phải `index.html` → **Open with Live Server**.
3. Dùng `http://127.0.0.1:5500` hoặc `http://localhost:5500` để khớp CORS của backend.
4. Chạy API bằng F5 trong Visual Studio với profile HTTPS, hoặc:

```powershell
dotnet run --project D:\RoomFinderSystem\RoomFinder.API --launch-profile https
```

API được cấu hình trong `js/config.js`: `https://localhost:7055`.
Nếu gặp lỗi kết nối, mở `https://localhost:7055/swagger`, kiểm tra API/database và chứng chỉ HTTPS. Có thể dùng `dotnet dev-certs https --trust` nếu trình duyệt chưa tin chứng chỉ phát triển.
Backend cần có migration District của phần 8A đã áp dụng vào database.

Trang chủ vẫn mở được khi API chưa chạy; các phần dữ liệu sẽ báo lỗi kèm nút thử lại. Không chèn phòng giả vào giao diện.

## Chức năng đã có

- Trang chủ công khai: giới thiệu, tìm nhanh theo khu vực/ngân sách, ba phòng mới nhất, hướng dẫn sử dụng.
- Danh sách phòng công khai: giá tối thiểu/tối đa, khu vực và chỉ phòng còn trống.
- Bộ lọc được giữ trong URL, dùng được khi tải lại trang hoặc chia sẻ đường dẫn.
- Kiểm tra giá tối thiểu không vượt giá tối đa; xóa lọc tải lại toàn bộ.
- Thẻ phòng: ảnh, giá Việt Nam, địa chỉ, diện tích, khu vực và tình trạng còn/hết phòng.
- Xử lý đang tải, không có kết quả, lỗi mạng, tải lại và ảnh thiếu/hỏng.
- Xem thông tin phòng trong hộp thoại mà không cần đăng nhập.
- Header thay đổi theo phiên đăng nhập; đăng xuất về trang chủ.
- Trang đăng nhập/đăng ký đồng bộ giao diện, hỗ trợ quay lại trang/phòng vừa xem.
- Escape dữ liệu trước khi đưa vào HTML, chỉ nhận URL ảnh HTTP(S); đường dẫn quay lại được giới hạn trong các trang công khai của ứng dụng.
- Giao diện thích ứng máy tính/điện thoại, nhãn biểu mẫu, thông báo trạng thái và điều hướng bàn phím.

## Luồng đăng nhập và đặt phòng

1. Khách vào trang chủ, tìm và xem chi tiết phòng tự do.
2. Bấm **Đặt phòng** trên phòng còn trống: nếu chưa đăng nhập hoặc phiên hết hạn, chuyển sang đăng nhập.
3. Nếu cần đăng ký, thông tin trang/phòng cần quay lại vẫn được giữ qua bước đăng ký.
4. Sau đăng nhập, quay lại đúng trang và mở lại thông tin phòng.
5. Backend hiện chỉ có Auth, Rooms và RoomImages, **chưa có API đặt phòng**. Vì vậy giao diện thông báo đặt phòng trực tuyến chưa mở; không tạo đơn, không trừ tiền và không báo đặt thành công.
6. Phòng đã cho thuê có nút đặt phòng bị vô hiệu hóa.

`isLoggedIn()` chỉ kiểm tra phiên để điều hướng giao diện. Khi xây API đặt phòng, backend cần xác thực JWT, quyền người dùng và tình trạng phòng.

## Các file chính

| File | Vai trò |
| --- | --- |
| `index.html`, `css/index.css`, `js/index.js` | Trang chủ công khai |
| `styles.css` | Giao diện dùng chung và trang xác thực |
| `js/utils.js` | `escapeHtml`, `formatPrice`, kiểm tra URL ảnh |
| `js/navigation.js` | Hiển thị menu khách/tài khoản |
| `js/rooms/room-api.js` | Gọi API phòng và khu vực |
| `js/rooms/room-ui.js` | Thẻ phòng, hộp thoại, yêu cầu đăng nhập khi đặt phòng |
| `pages/rooms/room-list.html` | Trang danh sách và biểu mẫu lọc |
| `css/rooms/room-list.css` | Giao diện danh sách, thẻ phòng, hộp thoại |
| `js/rooms/room-list.js` | Lọc, URL, trạng thái tải, chống kết quả cũ ghi đè kết quả mới |
| `js/auth/session.js` | JWT, phiên đăng nhập, đường dẫn quay lại an toàn |
| `pages/auth/`, `js/auth/` | Đăng ký và đăng nhập |
| `assets/images/home-room.svg` | Hình minh họa trang chủ lưu trong dự án |
| `tests/frontend.test.cjs` | Kiểm tra tương tác bằng Chrome headless |

Giữ cấu trúc sẵn có: `styles.css` và `css/rooms/room-list.css` tương ứng CSS chung và CSS module rooms trong tài liệu 8B.

## Kiểm tra

Kiểm tra cú pháp JavaScript:

```powershell
Get-ChildItem Frontend\js -Filter *.js -Recurse | ForEach-Object { node --check $_.FullName }
```

Chạy kiểm tra trình duyệt từ thư mục gốc `D:\RoomFinderSystem`:

```powershell
node Frontend/tests/frontend.test.cjs
```

Cần Node.js 22+ và Google Chrome. Mặc định dùng `C:\Program Files\Google\Chrome\Application\chrome.exe`; có thể đặt biến môi trường `CHROME_PATH` nếu Chrome nằm ở vị trí khác. Nếu terminal đang ở thư mục Frontend, dùng `node tests/frontend.test.cjs`.

Bài kiểm tra mở máy chủ tạm ở cổng ngẫu nhiên và Chrome headless với profile tạm, tự đóng khi kết thúc. Kiểm tra khách truy cập, tìm nhanh, lọc/xóa lọc, giá không hợp lệ, dữ liệu rỗng, lỗi/tải lại, phản hồi lệch thứ tự, XSS/URL ảnh, xem phòng, yêu cầu đăng nhập, đăng ký/đăng nhập rồi quay lại, đăng xuất, chặn chuyển hướng ngoài ứng dụng và bố cục mobile.

Bài kiểm tra cũng bao gồm phân quyền trang admin, giả mạo role trong localStorage, thêm/sửa/xóa phòng, đổi tình trạng, tải/xóa ảnh và thử lại khi tải ảnh lỗi mà không tạo phòng trùng.

Kiểm tra backend với bộ xác thực và người dùng thử nghiệm, không kết nối database thật:

```powershell
dotnet run --project tests/RoomFinder.Checks
```

Bộ kiểm tra chạy các controller và middleware phân quyền qua HTTP: khách/Customer/Student/Landlord bị chặn ghi dữ liệu; đăng ký không thể cấp Admin; đăng nhập chuẩn hóa vai trò cũ; dữ liệu phòng không hợp lệ bị từ chối. Đồng thời kiểm tra file ảnh, lưu/xóa file và giới hạn đường dẫn trong thư mục uploads. Không thay thế kiểm tra ghi dữ liệu thật với SQL Server.

Các bài kiểm tra dùng API mô phỏng, không tạo tài khoản hoặc sửa database thật. Cần kiểm tra thêm với API/database thực đang chạy để xác nhận tích hợp hoàn chỉnh.
