function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatPrice(value) {
  const price = Number(value);
  return Number.isFinite(price) ? price.toLocaleString('vi-VN') + ' đ/tháng' : 'Chưa có giá';
}

function roomImageUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, API_BASE_URL + '/');
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
