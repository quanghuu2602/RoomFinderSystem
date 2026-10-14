// JavaScript riêng của pages/auth/register.html.
const registerForm = document.getElementById("registerForm");
const btnRegister = document.getElementById("btnRegister");

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
    fullName: document.getElementById("fullName").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
    role: document.getElementById("role").value,
  };

  btnRegister.disabled = true;
  btnRegister.textContent = "Đang xử lý...";
  let registered = false;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      // API trả về danh sách lỗi dạng [{code, description}]
      const text = Array.isArray(data)
        ? data.map((x) => x.description).join(" | ")
        : data?.errors
          ? Object.values(data.errors).flat().join(" | ")
          : data?.message || `Đăng ký thất bại (HTTP ${res.status}).`;
      showMessage(text, "error");
    } else {
      registered = true;
      btnRegister.textContent = "Đã đăng ký";
      showMessage("Đăng ký thành công! Đang chuyển sang trang đăng nhập...", "success");
      setTimeout(() => (window.location.href = "login.html"), 1500);
    }
  } catch (err) {
    showMessage("Không kết nối được tới server. Kiểm tra API đã chạy (F5) chưa.", "error");
  } finally {
    if (!registered) {
      btnRegister.disabled = false;
      btnRegister.textContent = "Đăng ký";
    }
  }
});
