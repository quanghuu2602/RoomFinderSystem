// Hiện thông báo ở phần tử id="message", nếu trang có phần tử này.
function showMessage(text, type = "error") {
    const box = document.getElementById("message");
    if (!box) {
        return;
    }

    box.textContent = text;
    box.classList.add("message");
    box.classList.remove("error", "success");
    box.classList.add(type === "success" ? "success" : "error");
    box.hidden = false;
}
