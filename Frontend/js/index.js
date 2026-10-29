const homeGrid = document.getElementById('roomGrid');
const homeStatus = document.getElementById('status');
const homeRetry = document.getElementById('retryRooms');

async function loadLatestRooms() {
  RoomUI.loading(homeGrid);
  homeStatus.className = 'status info';
  homeStatus.textContent = 'Đang tìm những căn phòng mới nhất…';
  homeRetry.hidden = true;
  try {
    const rooms = await fetchRooms();
    RoomUI.render(homeGrid, rooms.slice(0, 3));
    homeStatus.className = 'status';
    homeStatus.textContent = '';
  } catch {
    homeGrid.replaceChildren();
    homeStatus.className = 'status error';
    homeStatus.textContent = 'Chưa thể tải danh sách phòng. Vui lòng thử lại sau ít phút.';
    homeRetry.hidden = false;
  } finally {
    homeGrid.setAttribute('aria-busy', 'false');
  }
}

async function loadHomeDistricts() {
  try {
    const districts = await fetchDistricts();
    const select = document.getElementById('homeDistrict');
    districts.forEach(district => select.add(new Option(district, district)));
  } catch {
    document.getElementById('districtHint').textContent = 'Chưa tải được khu vực. Bạn vẫn có thể tìm phòng theo ngân sách.';
  }
}

homeRetry.addEventListener('click', loadLatestRooms);
loadHomeDistricts();
loadLatestRooms();
RoomUI.restoreRoom();
