const roomGrid = document.getElementById('roomGrid');
const statusBox = document.getElementById('status');
const resultCount = document.getElementById('resultCount');
const filterForm = document.getElementById('filterForm');
const districtSelect = document.getElementById('district');
const retryButton = document.getElementById('retryRooms');
let latestRequest = 0;

function showStatus(text, type = 'info') {
  statusBox.className = text ? 'status ' + type : 'status';
  statusBox.textContent = text;
}

function getFilters() {
  return {
    minPrice: document.getElementById('minPrice').value,
    maxPrice: document.getElementById('maxPrice').value,
    district: districtSelect.value,
    onlyAvailable: document.getElementById('onlyAvailable').checked,
  };
}

function updateFilterUrl(filters) {
  const url = new URL(window.location.href);
  for (const key of ['minPrice', 'maxPrice', 'district', 'onlyAvailable']) {
    url.searchParams.delete(key);
    if (filters[key] !== '' && filters[key] !== false) {
      url.searchParams.set(key, filters[key]);
    }
  }
  history.replaceState(null, '', url);
}

async function loadRooms() {
  const request = ++latestRequest;
  const filters = getFilters();
  retryButton.hidden = true;
  if (filters.minPrice !== '' && filters.maxPrice !== '' && Number(filters.minPrice) > Number(filters.maxPrice)) {
    roomGrid.replaceChildren();
    roomGrid.setAttribute('aria-busy', 'false');
    resultCount.textContent = '';
    showStatus('Giá tối thiểu không được lớn hơn giá tối đa.', 'error');
    document.getElementById('maxPrice').focus();
    return;
  }
  updateFilterUrl(filters);
  RoomUI.loading(roomGrid);
  resultCount.textContent = '';
  showStatus('Đang tải danh sách phòng…');
  try {
    const rooms = await fetchRooms(filters);
    if (request !== latestRequest) return;
    RoomUI.render(roomGrid, rooms);
    resultCount.textContent = 'Tìm thấy ' + rooms.length + ' phòng';
    showStatus('');
  } catch {
    if (request !== latestRequest) return;
    roomGrid.replaceChildren();
    showStatus('Không tải được danh sách phòng. Vui lòng kiểm tra kết nối và thử lại.', 'error');
    retryButton.hidden = false;
  } finally {
    if (request === latestRequest) roomGrid.setAttribute('aria-busy', 'false');
  }
}

async function loadDistricts() {
  try {
    const districts = await fetchDistricts();
    const existing = new Set(Array.from(districtSelect.options, option => option.value));
    districts.forEach(district => {
      if (!existing.has(district)) {
        districtSelect.add(new Option(district, district));
        existing.add(district);
      }
    });
  } catch {
    document.getElementById('districtHint').textContent = 'Chưa tải được khu vực. Các bộ lọc giá và phòng trống vẫn dùng được.';
  }
}

function restoreFilters() {
  const params = new URLSearchParams(window.location.search);
  for (const key of ['minPrice', 'maxPrice']) {
    const value = params.get(key);
    if (value !== null && value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0) {
      document.getElementById(key).value = value;
    }
  }
  const district = params.get('district');
  if (district) {
    // Gán ngay để lần tải đầu tiên đã đúng, kể cả API khu vực chậm hoặc lỗi.
    districtSelect.add(new Option(district, district));
    districtSelect.value = district;
  }
  document.getElementById('onlyAvailable').checked = params.get('onlyAvailable') === 'true';
}

filterForm.addEventListener('submit', event => {
  event.preventDefault();
  loadRooms();
});
filterForm.addEventListener('reset', () => setTimeout(loadRooms, 0));
retryButton.addEventListener('click', loadRooms);
restoreFilters();
loadDistricts();
loadRooms();
RoomUI.restoreRoom();
