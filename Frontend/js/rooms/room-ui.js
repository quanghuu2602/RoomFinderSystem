const RoomUI = (() => {
  let roomsById = new Map();
  let detailRequest = 0;
  const dialog = document.createElement('dialog');
  dialog.className = 'room-dialog';
  dialog.setAttribute('aria-labelledby', 'roomDialogTitle');
  dialog.innerHTML = `<div class="dialog-header"><span id="roomDialogTitle">Thông tin phòng</span><button type="button" class="dialog-close" aria-label="Đóng thông tin phòng">×</button></div><div class="dialog-body" id="roomDialogBody" aria-live="polite"></div>`;
  document.body.append(dialog);
  const body = dialog.querySelector('.dialog-body');
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    detailRequest++;
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('booking');
    history.replaceState(null, '', url);
  });

  function media(room) {
    const src = roomImageUrl(room.thumbnailUrl);
    return `<div class="room-media">${src
      ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(room.title)}" loading="lazy">`
      : '<div class="no-image"><span aria-hidden="true">⌂</span>Chưa có ảnh phòng</div>'}
      <span class="badge ${room.isAvailable ? 'badge-ok' : 'badge-full'}">${room.isAvailable ? '● Còn trống' : 'Hết phòng'}</span></div>`;
  }

  function fixImages(container) {
    container.querySelectorAll('.room-media img').forEach(img => {
      const fallback = () => {
        const placeholder = document.createElement('div');
        placeholder.className = 'no-image';
        placeholder.innerHTML = '<span aria-hidden="true">⌂</span>Ảnh tạm thời không khả dụng';
        img.replaceWith(placeholder);
      };
      img.addEventListener('error', fallback, { once: true });
      if (img.complete && img.naturalWidth === 0) fallback();
    });
  }

  function card(room) {
    return `<article class="room-card">${media(room)}<div class="card-body">
      <div class="card-district">${escapeHtml(room.district || 'Chưa cập nhật khu vực')}</div>
      <h3>${escapeHtml(room.title)}</h3><p class="card-address">${escapeHtml(room.address)}</p>
      <div class="card-meta"><span>▧ ${escapeHtml(room.area)} m²</span><span>${room.isAvailable ? 'Sẵn sàng đón bạn' : 'Hiện đã cho thuê'}</span></div>
      <div class="card-footer"><span class="price">${escapeHtml(formatPrice(room.price))}</span><button type="button" data-room="${escapeHtml(room.id)}" aria-label="Xem phòng ${escapeHtml(room.title)}">Xem phòng ↗</button></div>
    </div></article>`;
  }

  function render(grid, rooms) {
    roomsById = new Map(rooms.map(room => [String(room.id), room]));
    grid.innerHTML = rooms.length ? rooms.map(card).join('')
      : '<div class="empty-state"><span aria-hidden="true">⌂</span><h3>Chưa tìm thấy phòng phù hợp</h3><p>Thử thay đổi khu vực hoặc mở rộng khoảng giá của bạn.</p></div>';
    grid.setAttribute('aria-busy', 'false');
    fixImages(grid);
    grid.querySelectorAll('[data-room]').forEach(button => {
      button.addEventListener('click', () => open(button.dataset.room));
    });
  }

  function loading(grid) {
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = '<div class="skeleton" aria-hidden="true"></div>'.repeat(3);
  }

  function showBookingNotice() {
    const note = document.getElementById('bookingNotice');
    note.hidden = false;
    note.textContent = 'Bạn đã đăng nhập. Đặt phòng trực tuyến hiện chưa được mở; chưa có yêu cầu đặt phòng nào được gửi.';
  }

  async function open(id, booking = false) {
    const request = ++detailRequest;
    const url = new URL(window.location.href);
    url.searchParams.set('room', id);
    history.replaceState(null, '', url);
    body.textContent = 'Đang tải thông tin phòng…';
    if (!dialog.open) dialog.showModal();
    try {
      // Luôn lấy tình trạng mới nhất trước khi hiển thị hành động đặt phòng.
      const room = { ...roomsById.get(String(id)), ...await fetchRoom(id) };
      if (request !== detailRequest || !dialog.open) return;
      const images = Array.isArray(room.images) ? room.images.filter(image => roomImageUrl(image.imageUrl)) : [];
      body.innerHTML = `${media(room)}${images.length > 1 ? `<div class="room-gallery" aria-label="Các ảnh của phòng">${images.map((image, index) => `<button type="button" class="gallery-thumb" data-image="${escapeHtml(roomImageUrl(image.imageUrl))}" aria-label="Xem ảnh ${index + 1}"><img src="${escapeHtml(roomImageUrl(image.imageUrl))}" alt="Ảnh phòng ${index + 1}"></button>`).join('')}</div>` : ''}<h2>${escapeHtml(room.title)}</h2><p class="muted">${escapeHtml(room.address)}</p>
        <div class="price">${escapeHtml(formatPrice(room.price))}</div>
        <dl class="detail-facts"><div><dt>Diện tích</dt><dd>${escapeHtml(room.area)} m²</dd></div><div><dt>Khu vực</dt><dd>${escapeHtml(room.district || 'Chưa cập nhật')}</dd></div></dl>
        <button type="button" id="bookRoom" ${room.isAvailable ? '' : 'disabled'}>${room.isAvailable ? 'Đặt phòng' : 'Phòng hiện đã cho thuê'}</button>
        <p class="booking-note">Đặt phòng trực tuyến sắp ra mắt. Bạn cần đăng nhập để tiếp tục bước này.</p>
        <div id="bookingNotice" class="status info" role="status" hidden></div>`;
      fixImages(body);
      body.querySelectorAll('[data-image]').forEach(button => button.addEventListener('click', () => {
        const mediaBox = body.querySelector('.room-media');
        mediaBox.querySelector('img, .no-image')?.remove();
        const image = document.createElement('img');
        image.src = button.dataset.image;
        image.alt = room.title;
        mediaBox.prepend(image);
        fixImages(mediaBox.parentElement);
      }));
      document.getElementById('bookRoom').addEventListener('click', () => {
        const returnUrl = new URL(window.location.href);
        returnUrl.searchParams.set('room', id);
        returnUrl.searchParams.set('booking', '1');
        if (requireLogin(returnUrl.href)) showBookingNotice();
      });
      if (booking && room.isAvailable && isLoggedIn()) showBookingNotice();
    } catch {
      if (request !== detailRequest || !dialog.open) return;
      body.innerHTML = '<p>Không tải được thông tin phòng. Phòng có thể đã bị xóa hoặc kết nối đang gián đoạn.</p><button type="button" id="retryDetail">Thử lại</button>';
      document.getElementById('retryDetail').addEventListener('click', () => open(id, booking));
    }
  }

  function restoreRoom() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('room');
    if (id && /^\d+$/.test(id)) open(id, params.get('booking') === '1');
  }

  return { render, loading, restoreRoom };
})();
