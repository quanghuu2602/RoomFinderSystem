// Trang tạm để kiểm tra phiên đăng nhập; danh sách phòng sẽ bổ sung ở Ngày 8.
if (!isLoggedIn()) {
  window.location.replace("../auth/login.html");
} else {
  document.getElementById("userInfo").textContent = `${getEmail()} (${getRole()})`;
  document.getElementById("btnLogout").addEventListener("click", logout);
}
