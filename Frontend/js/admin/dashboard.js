const adminContent = document.getElementById('adminContent');
const adminStatus = document.getElementById('adminStatus');
const editor = document.getElementById('editorDialog');
const form = document.getElementById('roomForm');
let rooms = [];
let editingId = null;
let pendingFiles = [];
let previewUrls = [];
let busy = false;
let listRequest = 0;

function status(element, message, type = 'info') {
  element.textContent = message;
  element.className = message ? 'status ' + type : 'status';
}

function setBusy(value) {
  busy = value;
  document.getElementById('editorFields').disabled = value;
  document.getElementById('saveRoom').disabled = value;
  document.getElementById('closeEditor').disabled = value;
  document.getElementById('newRoom').disabled = value;
  document.getElementById('refreshRooms').disabled = value;
  document.querySelectorAll('#adminRooms button').forEach(button => button.disabled = value);
}

function renderRooms() {
  const search = document.getElementById('adminSearch').value.trim().toLocaleLowerCase('vi');
  const filtered = rooms.filter(room => [room.title, room.address, room.district].join(' ').toLocaleLowerCase('vi').includes(search));
  document.getElementById('totalRooms').textContent = rooms.length;
  document.getElementById('availableRooms').textContent = rooms.filter(room => room.isAvailable).length;
  document.getElementById('occupiedRooms').textContent = rooms.filter(room => !room.isAvailable).length;
  const container = document.getElementById('adminRooms');
  container.innerHTML = filtered.length ? filtered.map(room => {
    const src = roomImageUrl(room.thumbnailUrl);
    return `<article class="admin-room">
      ${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(room.title)}">` : '<div class="admin-placeholder" aria-label="Chưa có ảnh">⌂</div>'}
      <div><span class="room-state ${room.isAvailable ? '' : 'full'}">${room.isAvailable ? '● Còn trống' : '● Đã cho thuê'} · #${escapeHtml(room.id)}</span><h2>${escapeHtml(room.title)}</h2><p>${escapeHtml(room.address)}</p><p>${escapeHtml(room.district)} · ${escapeHtml(room.area)} m²</p><p class="room-price">${escapeHtml(formatPrice(room.price))}</p></div>
      <div class="room-controls"><button type="button" data-edit="${escapeHtml(room.id)}">Sửa & ảnh</button><button class="btn-secondary" type="button" data-toggle="${escapeHtml(room.id)}">${room.isAvailable ? 'Đánh dấu đã thuê' : 'Mở cho thuê'}</button><button class="danger-button" type="button" data-delete="${escapeHtml(room.id)}">Xóa</button></div>
    </article>`;
  }).join('') : '<div class="admin-empty">Chưa có phòng phù hợp. Thêm phòng mới hoặc đổi từ khóa tìm kiếm.</div>';
  container.querySelectorAll('img').forEach(image => image.addEventListener('error', () => {
    const placeholder = document.createElement('div');
    placeholder.className = 'admin-placeholder';
    placeholder.textContent = '⌂';
    image.replaceWith(placeholder);
  }, {once:true}));
  container.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => openEditor(Number(button.dataset.edit))));
  container.querySelectorAll('[data-toggle]').forEach(button => button.addEventListener('click', () => toggleRoom(Number(button.dataset.toggle))));
  container.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => deleteRoom(Number(button.dataset.delete))));
  container.querySelectorAll('button').forEach(button => button.disabled = busy);
}

async function loadRooms() {
  const request = ++listRequest;
  document.getElementById('adminRooms').setAttribute('aria-busy', 'true');
  try {
    const data = await fetchRooms();
    if (request !== listRequest) return;
    rooms = data;
    renderRooms();
  } catch {
    if (request !== listRequest) return;
    status(adminStatus, 'Không tải được danh sách mới nhất. Bấm Tải lại danh sách để thử lại.', 'error');
  } finally {
    if (request === listRequest) document.getElementById('adminRooms').setAttribute('aria-busy', 'false');
  }
}

function clearPending() {
  previewUrls.forEach(url => URL.revokeObjectURL(url));
  previewUrls = [];
  pendingFiles = [];
  document.getElementById('roomImages').value = '';
  document.getElementById('pendingImages').replaceChildren();
}

function renderPending() {
  previewUrls.forEach(url => URL.revokeObjectURL(url));
  previewUrls = pendingFiles.map(file => URL.createObjectURL(file));
  const container = document.getElementById('pendingImages');
  container.innerHTML = pendingFiles.map((file, index) => `<div class="image-item"><img src="${previewUrls[index]}" alt="Ảnh chuẩn bị tải lên"><p>${escapeHtml(file.name)}</p><button type="button" class="btn-secondary" data-remove-pending="${index}">Bỏ ảnh này</button></div>`).join('');
  container.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    pendingFiles.splice(Number(button.dataset.removePending), 1);
    renderPending();
  }));
}

async function loadImages() {
  const id = editingId;
  const container = document.getElementById('savedImages');
  status(document.getElementById('imageStatus'), '');
  if (!id) { container.replaceChildren(); return; }
  try {
    const images = await AdminAPI.images(id);
    if (editingId !== id) return;
    container.innerHTML = images.map((image, index) => `<div class="image-item"><img src="${escapeHtml(roomImageUrl(image.imageUrl))}" alt="Ảnh phòng ${index + 1}"><p>${index === 0 ? 'Ảnh đại diện' : 'Ảnh ' + (index + 1)}</p><button type="button" class="danger-button" data-delete-image="${escapeHtml(image.id)}">Xóa ảnh</button></div>`).join('');
    container.querySelectorAll('button').forEach(button => button.addEventListener('click', async () => {
      if (busy || !confirm('Xóa ảnh này khỏi phòng? Thao tác có hiệu lực ngay.')) return;
      setBusy(true);
      try {
        await AdminAPI.removeImage(id, Number(button.dataset.deleteImage));
        await loadImages();
        await loadRooms();
      } catch (error) { status(document.getElementById('imageStatus'), error.message, 'error'); }
      finally { setBusy(false); }
    }));
  } catch (error) {
    status(document.getElementById('imageStatus'), 'Chưa tải được ảnh hiện tại. ' + error.message, 'error');
    container.replaceChildren();
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn-outline';
    retry.textContent = 'Tải lại ảnh';
    retry.addEventListener('click', loadImages);
    container.append(retry);
  }
}

async function openEditor(id = null) {
  if (busy) return;
  editingId = id;
  clearPending();
  form.reset();
  document.getElementById('savedImages').replaceChildren();
  status(document.getElementById('imageStatus'), '');
  status(document.getElementById('editorStatus'), '');
  document.getElementById('editorTitle').textContent = id ? 'Chỉnh sửa phòng #' + id : 'Thêm phòng mới';
  editor.showModal();
  if (!id) return;
  setBusy(true);
  try {
    const room = await fetchRoom(id);
    document.getElementById('roomTitle').value = room.title;
    document.getElementById('roomAddress').value = room.address;
    document.getElementById('roomDistrict').value = room.district;
    document.getElementById('roomArea').value = room.area;
    document.getElementById('roomPrice').value = room.price;
    document.getElementById('roomAvailable').value = String(room.isAvailable);
    await loadImages();
  } catch {
    editor.close();
    status(adminStatus, 'Không mở được phòng. Vui lòng tải lại danh sách và thử lại.', 'error');
  } finally { setBusy(false); }
}

async function saveRoom(event) {
  event.preventDefault();
  if (busy) return;
  const payload = {
    title: document.getElementById('roomTitle').value.trim(),
    address: document.getElementById('roomAddress').value.trim(),
    district: document.getElementById('roomDistrict').value.trim(),
    area: Number(document.getElementById('roomArea').value),
    price: Number(document.getElementById('roomPrice').value),
  };
  const message = document.getElementById('editorStatus');
  if (!payload.title || !payload.address || !payload.district) {
    status(message, 'Vui lòng nhập tên phòng, địa chỉ và khu vực.', 'error');
    return;
  }
  const available = document.getElementById('roomAvailable').value === 'true';
  setBusy(true);
  status(message, 'Đang lưu thông tin phòng…');
  let saved = false;
  try {
    const room = editingId ? await AdminAPI.update(editingId, payload) : await AdminAPI.create(payload);
    editingId = room.id; // Giữ ID ngay: nếu tải ảnh lỗi, lần thử lại không tạo phòng trùng.
    saved = true;
    document.getElementById('editorTitle').textContent = 'Chỉnh sửa phòng #' + editingId;
    if (room.isAvailable !== available) await AdminAPI.availability(editingId, available);
    if (pendingFiles.length) {
      status(message, 'Đã lưu thông tin. Đang tải ảnh lên…');
      await AdminAPI.upload(editingId, pendingFiles);
      clearPending();
    }
    status(adminStatus, 'Đã lưu phòng và ảnh. Nội dung đã hiển thị trên website.');
    editor.close();
    await loadRooms();
  } catch (error) {
    status(message, (saved ? 'Thông tin phòng đã được lưu, nhưng chưa hoàn tất tình trạng hoặc ảnh. ' : '') + error.message + ' Bạn có thể bấm Lưu phòng để thử lại.', 'error');
    if (saved) { await loadImages(); await loadRooms(); }
  } finally { setBusy(false); }
}

async function toggleRoom(id) {
  if (busy) return;
  const room = rooms.find(item => item.id === id);
  setBusy(true);
  try {
    await AdminAPI.availability(id, !room.isAvailable);
    status(adminStatus, 'Đã cập nhật tình trạng phòng.');
    await loadRooms();
  } catch (error) { status(adminStatus, error.message, 'error'); }
  finally { setBusy(false); }
}

async function deleteRoom(id) {
  if (busy) return;
  const room = rooms.find(item => item.id === id);
  if (!confirm('Xóa phòng "' + room.title + '" và toàn bộ ảnh? Thao tác không thể hoàn tác.')) return;
  setBusy(true);
  try {
    await AdminAPI.remove(id);
    status(adminStatus, 'Đã xóa phòng và ảnh.');
    await loadRooms();
  } catch (error) { status(adminStatus, error.message, 'error'); }
  finally { setBusy(false); }
}

document.getElementById('roomImages').addEventListener('change', event => {
  const files = Array.from(event.target.files);
  if (files.length + pendingFiles.length > 10 || files.some(file => !/\.(jpe?g|png|webp)$/i.test(file.name) || file.size === 0 || file.size > 5 * 1024 * 1024)) {
    status(document.getElementById('editorStatus'), 'Chọn tối đa 10 ảnh JPG, PNG hoặc WebP, mỗi ảnh không quá 5 MB và không rỗng.', 'error');
  } else {
    pendingFiles.push(...files);
    renderPending();
    status(document.getElementById('editorStatus'), '');
  }
  event.target.value = '';
});
form.addEventListener('submit', saveRoom);
document.getElementById('newRoom').addEventListener('click', () => openEditor());
document.getElementById('closeEditor').addEventListener('click', () => {
  if (!busy && (!pendingFiles.length || confirm('Đóng và bỏ các ảnh chưa tải lên?'))) editor.close();
});
editor.addEventListener('cancel', event => { if (busy || (pendingFiles.length && !confirm('Đóng và bỏ các ảnh chưa tải lên?'))) event.preventDefault(); });
editor.addEventListener('close', clearPending);
document.getElementById('refreshRooms').addEventListener('click', () => { status(adminStatus, ''); loadRooms(); });
document.getElementById('adminSearch').addEventListener('input', renderRooms);
document.getElementById('adminLogout').addEventListener('click', logout);
document.getElementById('retryAccess').addEventListener('click', initAdmin);

async function initAdmin() {
  if (!requireLogin(window.location.href)) return;
  const access = document.getElementById('accessStatus');
  document.getElementById('retryAccess').hidden = true;
  status(access, 'Đang kiểm tra quyền quản trị…');
  try {
    // Quyền phải được server xác nhận, không tin localStorage.
    const user = await AdminAPI.me();
    if (user.role !== 'Admin') {
      status(access, 'Trang này chỉ dành cho quản trị viên công ty. Bạn có thể tiếp tục xem phòng tại trang chủ.', 'error');
      return;
    }
    adminContent.hidden = false;
    status(access, '');
    await loadRooms();
  } catch (error) {
    status(access, error.message || 'Không thể kiểm tra tài khoản. Vui lòng thử lại.', 'error');
    document.getElementById('retryAccess').hidden = false;
  }
}
initAdmin();
