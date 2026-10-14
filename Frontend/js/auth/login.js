// JavaScript riêng của pages/auth/login.html.
const loginForm = document.getElementById("loginForm");
const btnLogin = document.getElementById("btnLogin");

// Đã đăng nhập rồi thì không cần vào trang này nữa
if (isLoggedIn()) {
  window.location.href = "../rooms/room-list.html";
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
  };

  btnLogin.disabled = true;
  btnLogin.textContent = "Đang đăng nhập...";

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      showMessage(data?.message || `Đăng nhập thất bại (HTTP ${res.status}).`, "error");
    } else {
      try {
        saveSession(data?.token);
      } catch {
        showMessage("Không thể lưu phiên đăng nhập. Token không hợp lệ hoặc bộ nhớ trình duyệt không khả dụng.", "error");
        return;
      }
      window.location.href = "../rooms/room-list.html";
    }
  } catch (err) {
    showMessage("Không kết nối được tới server. Kiểm tra API đã chạy (F5) chưa.", "error");
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = "Đăng nhập";
  }
});
