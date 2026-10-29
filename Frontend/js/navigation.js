(() => {
  const menu = document.getElementById('userMenu');
  if (!menu) return;
  if (isLoggedIn()) {
    menu.replaceChildren();
    const info = document.createElement('span');
    info.id = 'userInfo';
    info.textContent = getEmail() || 'Tài khoản';
    info.title = `${getEmail() || ''} (${getRole() || ''})`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-outline';
    button.textContent = 'Đăng xuất';
    button.addEventListener('click', logout);
    menu.append(info, button);
    if (getRole() === 'Admin') {
      const adminLink = document.createElement('a');
      adminLink.href = new URL('pages/admin/dashboard.html', APP_ROOT_URL).href;
      adminLink.className = 'text-link';
      adminLink.textContent = 'Quản trị';
      menu.prepend(adminLink);
    }
  } else {
    const login = menu.querySelector('[data-login]');
    if (login) {
      const url = new URL(LOGIN_PAGE_URL);
      url.searchParams.set('next', window.location.href);
      login.href = url.href;
    }
  }
})();
