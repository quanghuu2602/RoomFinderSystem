// Tên claim mà AuthController của .NET đưa vào JWT.
const ROLE_CLAIM = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
const EMAIL_CLAIM = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress";

// Tính từ file này để đăng xuất vẫn đúng khi mở Live Server từ thư mục dự án.
const LOGIN_PAGE_URL = new URL("../../pages/auth/login.html", document.currentScript.src).href;

// Chỉ đọc payload; chữ ký và quyền truy cập vẫn do API kiểm tra.
function parseJwt(token) {
    if (typeof token !== "string") {
        throw new Error("Token đăng nhập không hợp lệ.");
    }

    const parts = token.split(".");
    if (parts.length !== 3 || parts.some((part) => !part)) {
        throw new Error("Token đăng nhập không hợp lệ.");
    }

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json = decodeURIComponent(
        atob(paddedBase64)
            .split("")
            .map((character) => "%" + character.charCodeAt(0).toString(16).padStart(2, "0"))
            .join("")
    );
    const payload = JSON.parse(json);

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("Nội dung token đăng nhập không hợp lệ.");
    }

    return payload;
}

function saveSession(token) {
    const payload = parseJwt(token);
    if (!Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) {
        throw new Error("Phiên đăng nhập đã hết hạn hoặc thiếu thời hạn.");
    }

    localStorage.setItem("token", token);
    localStorage.setItem("email", payload[EMAIL_CLAIM] || payload.email || "");
    localStorage.setItem("role", payload[ROLE_CLAIM] || payload.role || "");
}

function getToken() {
    return localStorage.getItem("token");
}

function getRole() {
    return localStorage.getItem("role");
}

function getEmail() {
    return localStorage.getItem("email");
}

function isLoggedIn() {
    try {
        const payload = parseJwt(getToken());
        return Number.isFinite(payload.exp) && payload.exp > Date.now() / 1000;
    } catch {
        return false;
    }
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    localStorage.removeItem("role");
    window.location.href = LOGIN_PAGE_URL;
}
