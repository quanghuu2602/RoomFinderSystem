// JavaScript riêng của pages/auth/login.html.
const loginForm = document.getElementById("loginForm");
const btnLogin = document.getElementById("btnLogin");

// Đã đăng nhập rồi thì không cần vào trang này nữa
if (isLoggedIn()) {
  window.location.replace(getReturnUrl());
}

const registerLink = document.getElementById('registerLink');
const registerUrl = new URL('register.html', window.location.href);
registerUrl.searchParams.set('next', getReturnUrl());
registerLink.href = registerUrl.href;
if (new URLSearchParams(window.location.search).has('next')) {
  document.getElementById('loginHint').textContent = 'Đăng nhập để tiếp tục. Bạn sẽ quay lại trang vừa xem.';
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
      window.location.href = getReturnUrl();
    }
  } catch (err) {
    showMessage("Không thể kết nối. Vui lòng kiểm tra mạng và thử lại sau.", "error");
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = "Đăng nhập";
  }
});
