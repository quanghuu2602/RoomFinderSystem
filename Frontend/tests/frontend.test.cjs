// Browser regression checks. Node 22+ and a local Chrome installation; no npm packages.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try {
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
      res.setHeader('Content-Type', (types[path.extname(file)] || 'text/plain') + '; charset=utf-8');
      res.end(fs.readFileSync(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'roomfinder-browser-'));
  const browser = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    const activePort = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; !fs.existsSync(activePort) && i < 100; i++) await pause(100);
    assert.ok(fs.existsSync(activePort), 'Chrome starts');
    const port = fs.readFileSync(activePort, 'utf8').split('\n')[0];
    const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list', {signal: AbortSignal.timeout(10000)})).json();
    socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Chrome connection timed out')), 10000);
      socket.onopen = () => { clearTimeout(timeout); resolve(); };
      socket.onerror = error => { clearTimeout(timeout); reject(error); };
    });
    let sequence = 0;
    const pending = new Map();
    const errors = [];
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', {accept:true});
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
      if (message.id) {
        const task = pending.get(message.id);
        if (task) { pending.delete(message.id); message.error ? task.reject(message.error) : task.resolve(message.result); }
      }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Chrome command timed out: ' + method)); }, 10000);
      pending.set(id, { resolve: result => { clearTimeout(timeout); resolve(result); }, reject: error => { clearTimeout(timeout); reject(error); } });
      socket.send(JSON.stringify({ id, method, params }));
    });
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
    const mock = `(() => {
      const realFetch = window.fetch.bind(window);
      window.__calls = [];
      window.__writes = [];
      let rooms = [
        {id:1,title:'Studio ngập nắng, có ban công',address:'12 Đường số 3, Bình Thạnh',district:'Bình Thạnh',price:3200000,area:28,isAvailable:true,thumbnailUrl:null},
        {id:2,title:'Phòng nhỏ, không gian ấm áp',address:'25 Nguyễn Văn Cừ',district:'Quận 5',price:1800000,area:20,isAvailable:true,thumbnailUrl:'/missing.jpg'},
        {id:3,title:'Căn phòng gần trường học',address:'8 Đường số 10',district:'Thủ Đức',price:2500000,area:25,isAvailable:false,thumbnailUrl:null},
        {id:4,title:'<img src=x onerror=window.__xss=1>',address:'<script>window.__xss=1<\\/script>',district:'Quận 5',price:4000000,area:'<img src=x onerror=window.__xss=1>',isAvailable:true,thumbnailUrl:'javascript:alert(1)'}
      ];
      const images = {};
      let nextId = 5;
      const token = () => 'header.' + btoa(JSON.stringify({email:'test@example.com',role:sessionStorage.getItem('testRole') || 'Customer',exp:Math.floor(Date.now()/1000)+3600})) + '.signature';
      window.fetch = async (input, options = {}) => {
        const url = new URL(input, location.href);
        if (!url.pathname.startsWith('/api/')) return realFetch(input, options);
        window.__calls.push(url.pathname + url.search);
        if (options.method && options.method !== 'GET') window.__writes.push({path:url.pathname,method:options.method,auth:options.headers?.Authorization});
        const mode = sessionStorage.getItem('apiMode');
        if (mode === 'error' || (mode === 'district-error' && url.pathname.endsWith('/districts'))) throw new Error('Fixture network error');
        if (url.pathname === '/api/auth/login') return new Response(JSON.stringify({token:token()}));
        if (url.pathname === '/api/auth/register') return new Response('{}');
        if (url.pathname === '/api/auth/me') return new Response(JSON.stringify({email:'test@example.com',role:sessionStorage.getItem('testRole') || 'Customer'}));
        const imageMatch = url.pathname.match(/\\/rooms\\/(\\d+)\\/images(?:\\/(\\d+))?$/);
        if (imageMatch) {
          const id = Number(imageMatch[1]);
          images[id] ||= [];
          if (options.method === 'POST') {
            if (sessionStorage.getItem('uploadError')) return new Response(JSON.stringify({message:'Upload failed'}), {status:500});
            images[id].push(...options.body.getAll('files').map((file,index) => ({id:100+index,imageUrl:'/uploads/test.png'})));
          }
          if (options.method === 'DELETE') images[id] = images[id].filter(image => image.id !== Number(imageMatch[2]));
          return new Response(JSON.stringify(images[id]));
        }
        if (url.pathname === '/api/rooms' && options.method === 'POST') {
          const room = {...JSON.parse(options.body),id:nextId++,isAvailable:true};
          rooms.push(room);
          return new Response(JSON.stringify(room));
        }
        const roomMatch = url.pathname.match(/\\/rooms\\/(\\d+)(\\/availability)?$/);
        if (roomMatch && options.method) {
          const room = rooms.find(item => item.id === Number(roomMatch[1]));
          if (options.method === 'DELETE') rooms = rooms.filter(item => item !== room);
          else Object.assign(room, JSON.parse(options.body));
          return new Response(JSON.stringify(room));
        }
        if (url.pathname.endsWith('/districts')) return new Response(JSON.stringify(['Bình Thạnh','Quận 5','Thủ Đức']));
        if (/\\/api\\/rooms\\/\\d+$/.test(url.pathname)) {
          const room = rooms.find(item => item.id === Number(url.pathname.split('/').pop()));
          return new Response(JSON.stringify(room || {}), {status:room ? 200 : 404});
        }
        const params = url.searchParams;
        if (mode === 'race') await new Promise(resolve => setTimeout(resolve, params.get('maxPrice') === '2000000' ? 450 : 10));
        let result = rooms.filter(room =>
          (!params.has('minPrice') || room.price >= Number(params.get('minPrice'))) &&
          (!params.has('maxPrice') || room.price <= Number(params.get('maxPrice'))) &&
          (!params.get('district') || room.district === params.get('district')) &&
          (params.get('onlyAvailable') !== 'true' || room.isAvailable));
        if (mode === 'empty') result = [];
        return new Response(JSON.stringify(result));
      };
    })();`;
    await send('Page.addScriptToEvaluateOnNewDocument', { source: mock });
    async function evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
    async function waitFor(expression) {
      for (let i = 0; i < 100; i++) {
        try { if (await evaluate(expression)) return; } catch {}
        await pause(50);
      }
      throw new Error('Timed out: ' + expression);
    }
    async function go(relative, condition) {
      await send('Page.navigate', { url: base + relative });
      await waitFor('location.pathname === ' + JSON.stringify(relative.split('?')[0]) + ' && document.readyState === "complete"');
      if (condition) await waitFor(condition);
    }
    const count = 'document.querySelectorAll(".room-card").length';
    await go('/index.html', count + ' === 3');
    assert.equal(await evaluate('isLoggedIn()'), false);
    assert.equal(await evaluate('location.pathname'), '/index.html');
    assert.equal(await evaluate('document.querySelectorAll("#homeDistrict option").length'), 4);
    await evaluate('document.querySelector("#homeBudget").value="3000000"; document.querySelector("#homeDistrict").value="Quận 5"; document.querySelector("#homeSearch").requestSubmit()');
    await waitFor('location.pathname.endsWith("/room-list.html") && ' + count + ' === 1');
    assert.ok((await evaluate('location.search')).includes('maxPrice=3000000'));
    await evaluate('document.querySelector("#filterForm").reset()');
    await waitFor(count + ' === 4');
    assert.equal(await evaluate('window.__xss || 0'), 0);
    assert.equal(await evaluate('document.querySelector(".room-card:last-child h3").textContent'), '<img src=x onerror=window.__xss=1>');
    assert.equal(await evaluate('document.querySelectorAll(".room-card:last-child img").length'), 0);
    await evaluate('document.querySelector("#minPrice").value="4000000"; document.querySelector("#maxPrice").value="2000000"; document.querySelector("#filterForm").requestSubmit()');
    await waitFor('document.querySelector("#status").classList.contains("error")');
    assert.ok((await evaluate('document.querySelector("#status").textContent')).includes('tối thiểu'));
    await evaluate('document.querySelector("#filterForm").reset()');
    await waitFor(count + ' === 4');
    await evaluate('document.querySelector("#onlyAvailable").checked=true; document.querySelector("#filterForm").requestSubmit()');
    await waitFor(count + ' === 3');
    await evaluate('document.querySelector("#minPrice").value="9000000"; document.querySelector("#filterForm").requestSubmit()');
    await waitFor('!!document.querySelector(".empty-state")');
    await evaluate('document.querySelector("#filterForm").reset()');
    await waitFor(count + ' === 4');
    await evaluate('sessionStorage.setItem("apiMode","race"); document.querySelector("#maxPrice").value="2000000"; document.querySelector("#filterForm").requestSubmit(); document.querySelector("#maxPrice").value="3000000"; document.querySelector("#filterForm").requestSubmit()');
    await pause(650);
    assert.equal(await evaluate(count), 2, 'Older requests cannot replace newer results');
    await evaluate('sessionStorage.removeItem("apiMode"); document.querySelector("#filterForm").reset()');
    await waitFor(count + ' === 4');
    await evaluate('document.querySelectorAll("[data-room]")[2].click()');
    await waitFor('!!document.querySelector("#bookRoom")');
    assert.equal(await evaluate('document.querySelector("#bookRoom").disabled'), true);
    await evaluate('document.querySelector(".dialog-close").click()');
    await pause(100);
    await evaluate('document.querySelectorAll("[data-room]")[0].click()');
    await waitFor('!!document.querySelector("#bookRoom")');
    assert.equal(await evaluate('isLoggedIn()'), false, 'Viewing detail requires no login');
    await evaluate('document.querySelector("#bookRoom").click()');
    await waitFor('location.pathname.endsWith("/login.html") && !!document.querySelector("#registerLink")');
    await evaluate('document.querySelector("#registerLink").click()');
    await waitFor('location.pathname.endsWith("/register.html") && !!document.querySelector("#loginLink")');
    assert.ok((await evaluate('document.querySelector("#loginLink").href')).includes('booking'));
    await evaluate('document.querySelector("#fullName").value="Test User"; document.querySelector("#email").value="test@example.com"; document.querySelector("#password").value="Test123!"; document.querySelector("#registerForm").requestSubmit()');
    await waitFor('location.pathname.endsWith("/login.html") && !!document.querySelector("#loginForm")');
    await evaluate('document.querySelector("#email").value="test@example.com"; document.querySelector("#password").value="Test123!"; document.querySelector("#loginForm").requestSubmit()');
    await waitFor('location.pathname.endsWith("/room-list.html") && !!document.querySelector("#bookingNotice")');
    assert.equal(await evaluate('document.querySelector("#bookingNotice").hidden'), false);
    assert.ok((await evaluate('document.querySelector("#bookingNotice").textContent')).includes('chưa có yêu cầu'));
    assert.ok((await evaluate('window.__calls')).every(url => !url.includes('/booking')));
    await evaluate('document.querySelector(".dialog-close").click(); document.querySelector("#userMenu button").click()');
    await waitFor('location.pathname === "/index.html" && !!document.querySelector("[data-login]")');
    assert.equal(await evaluate('localStorage.getItem("token")'), null);
    await go('/pages/auth/login.html?next=https%3A%2F%2Fevil.example');
    assert.equal(await evaluate('getReturnUrl()'), base + '/pages/rooms/room-list.html');
    await go('/pages/rooms/room-list.html', count + ' === 4');
    await evaluate('sessionStorage.setItem("apiMode","error"); document.querySelector("#filterForm").requestSubmit()');
    await waitFor('!document.querySelector("#retryRooms").hidden');
    assert.equal(await evaluate(count), 0);
    await evaluate('sessionStorage.removeItem("apiMode"); document.querySelector("#retryRooms").click()');
    await waitFor(count + ' === 4');
    await evaluate('sessionStorage.setItem("apiMode","district-error")');
    await go('/pages/rooms/room-list.html?district=Qu%E1%BA%ADn+5', count + ' === 2');
    assert.ok((await evaluate('document.querySelector("#districtHint").textContent')).includes('Chưa tải'));
    await evaluate('sessionStorage.removeItem("apiMode")');
    await go('/index.html', count + ' === 3');
    const screenshots = process.env.ROOMFINDER_SCREENSHOTS;
    if (screenshots) {
      fs.mkdirSync(screenshots, {recursive:true});
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      fs.writeFileSync(path.join(screenshots, 'home-desktop.png'), Buffer.from(shot.data, 'base64'));
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    for (const url of ['/index.html', '/pages/rooms/room-list.html', '/pages/auth/login.html', '/pages/auth/register.html']) {
      await go(url);
      assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'No mobile overflow: ' + url);
      if (url === '/index.html' && screenshots) {
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        fs.writeFileSync(path.join(screenshots, 'home-mobile.png'), Buffer.from(shot.data, 'base64'));
      }
    }
    // Admin access is checked with /auth/me, even if localStorage has been forged.
    await send('Page.navigate', {url:base + '/pages/admin/dashboard.html'});
    await waitFor('location.pathname.endsWith("/login.html")');
    await evaluate('saveSession("header." + btoa(JSON.stringify({email:"test@example.com",role:"Customer",exp:Date.now()/1000+3600})) + ".signature"); localStorage.setItem("role","Admin")');
    await go('/pages/admin/dashboard.html', 'document.querySelector("#accessStatus").classList.contains("error")');
    assert.equal(await evaluate('document.querySelector("#adminContent").hidden'), true);
    await evaluate('sessionStorage.setItem("testRole","Admin"); saveSession("header." + btoa(JSON.stringify({email:"admin@example.com",role:"Admin",exp:Date.now()/1000+3600})) + ".signature")');
    await go('/pages/admin/dashboard.html', 'document.querySelectorAll(".admin-room").length === 4');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Admin mobile does not overflow');
    await evaluate('document.querySelector("#newRoom").click()');
    await evaluate(`document.querySelector('#roomTitle').value='New company studio'; document.querySelector('#roomAddress').value='12 Test Street'; document.querySelector('#roomDistrict').value='District 1'; document.querySelector('#roomArea').value=30; document.querySelector('#roomPrice').value=3500000; const transfer=new DataTransfer(); transfer.items.add(new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII='), c=>c.charCodeAt(0))], 'room.png', {type:'image/png'})); document.querySelector('#roomImages').files=transfer.files; document.querySelector('#roomImages').dispatchEvent(new Event('change')); sessionStorage.setItem('uploadError','1'); document.querySelector('#roomForm').requestSubmit()`);
    await waitFor('document.querySelector("#editorStatus").classList.contains("error") && !document.querySelector("#saveRoom").disabled');
    assert.equal(await evaluate('window.__writes.filter(item => item.path === "/api/rooms" && item.method === "POST").length'), 1);
    await evaluate('sessionStorage.removeItem("uploadError"); document.querySelector("#roomForm").requestSubmit()');
    await waitFor('!document.querySelector("#editorDialog").open && document.querySelectorAll(".admin-room").length === 5');
    assert.equal(await evaluate('window.__writes.filter(item => item.path === "/api/rooms" && item.method === "POST").length'), 1, 'Retry upload must not create duplicate room');
    assert.ok((await evaluate('window.__writes')).every(item => item.auth?.startsWith('Bearer ')));
    await evaluate('document.querySelectorAll("[data-toggle]")[4].click()');
    await waitFor('document.querySelectorAll(".admin-room .full").length === 2 && !document.querySelector("#newRoom").disabled');
    await evaluate('document.querySelectorAll("[data-edit]")[4].click()');
    await waitFor('document.querySelectorAll("[data-delete-image]").length === 1 && !document.querySelector("#saveRoom").disabled');
    await evaluate('document.querySelector("[data-delete-image]").click()');
    await waitFor('document.querySelectorAll("[data-delete-image]").length === 0 && !document.querySelector("#saveRoom").disabled');
    await evaluate('document.querySelector("#roomTitle").value="Updated company studio"; document.querySelector("#roomForm").requestSubmit()');
    await waitFor('!document.querySelector("#editorDialog").open && document.querySelector("#adminRooms").textContent.includes("Updated company studio")');
    if (screenshots) {
      await send('Emulation.setDeviceMetricsOverride', {width:1440,height:1000,deviceScaleFactor:1,mobile:false});
      const shot = await send('Page.captureScreenshot', {format:'png',captureBeyondViewport:true});
      fs.writeFileSync(path.join(screenshots,'admin-desktop.png'), Buffer.from(shot.data,'base64'));
    }
    await evaluate('document.querySelectorAll("[data-delete]")[4].click()');
    await waitFor('document.querySelectorAll(".admin-room").length === 4');
    assert.deepEqual(errors, [], 'No uncaught browser exceptions');
    console.log('PASS: guest browsing, home search, filters/reset/validation, empty/error/retry, request race, XSS/image handling, detail, booking login gate, registration/login return, logout, redirect safety, mobile layouts.');
    console.log('PASS: admin/guest/customer access, forged local role denied, create/edit/delete, availability, multipart upload and image deletion, partial-upload retry without duplicate room, admin mobile layout.');
  } finally {
    if (socket) socket.close();
    browser.kill();
    server.close();
    await pause(700);
    const resolved = path.resolve(profile);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('roomfinder-browser-')) {
      fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
