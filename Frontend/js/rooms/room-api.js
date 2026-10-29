async function fetchRoomData(path, signal) {
  const response = await fetch(`${API_BASE_URL}/api/rooms${path}`, {
    signal: signal || AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Không tải được dữ liệu phòng (HTTP ${response.status}).`);
  return response.json();
}

async function fetchRooms(filters = {}, signal) {
  const params = new URLSearchParams();
  for (const key of ['minPrice', 'maxPrice', 'district']) {
    if (filters[key] !== '' && filters[key] != null) params.set(key, filters[key]);
  }
  if (filters.onlyAvailable) params.set('onlyAvailable', 'true');
  const query = params.toString();
  const rooms = await fetchRoomData(query ? '?' + query : '', signal);
  if (!Array.isArray(rooms)) throw new Error('Danh sách phòng không hợp lệ.');
  return rooms;
}

async function fetchDistricts() {
  const districts = await fetchRoomData('/districts');
  if (!Array.isArray(districts)) throw new Error('Danh sách khu vực không hợp lệ.');
  return districts;
}

async function fetchRoom(id) {
  return fetchRoomData('/' + encodeURIComponent(id));
}
