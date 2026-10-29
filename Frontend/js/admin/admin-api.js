async function adminRequest(path, options = {}) {
  const headers = { Authorization: 'Bearer ' + getToken(), ...options.headers };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(API_BASE_URL + '/api' + path, {
    ...options, headers, signal: AbortSignal.timeout(60000),
  });
  if (response.status === 401) {
    localStorage.removeItem('token');
    requireLogin(window.location.href);
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }
  if (response.status === 403) throw new Error('Tài khoản không có quyền quản trị.');
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.errors ? Object.values(data.errors).flat().join(' ') : data?.message;
    throw new Error(message || 'Không thực hiện được thao tác (HTTP ' + response.status + ').');
  }
  return data;
}

const AdminAPI = {
  me: () => adminRequest('/auth/me'),
  create: room => adminRequest('/rooms', { method: 'POST', body: JSON.stringify(room) }),
  update: (id, room) => adminRequest('/rooms/' + id, { method: 'PUT', body: JSON.stringify(room) }),
  remove: id => adminRequest('/rooms/' + id, { method: 'DELETE' }),
  availability: (id, isAvailable) => adminRequest('/rooms/' + id + '/availability', { method: 'PATCH', body: JSON.stringify({ isAvailable }) }),
  images: id => adminRequest('/rooms/' + id + '/images'),
  upload: (id, files) => {
    const form = new FormData();
    files.forEach(file => form.append('files', file));
    return adminRequest('/rooms/' + id + '/images', { method: 'POST', body: form });
  },
  removeImage: (id, imageId) => adminRequest('/rooms/' + id + '/images/' + imageId, { method: 'DELETE' }),
};
