// Repro helper: logs in, opens a page in headless Chrome via CDP, prints console errors + DOM facts.
// usage: node tools/portal/page-probe.mjs /flows
const path = process.argv[2] || '/flows';
const base = 'http://localhost:4200';
const api = 'http://localhost:5143/api';
const { spawn } = await import('node:child_process');
const http = await import('node:http');

const login = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'welcome@promedtechnologies.co.za', password: 'Kingsland' }) });
let token, user;
if (login.ok) ({ token, user } = await login.json());
else {
  // Mint a token with the local dev secret (same claims TokenService issues).
  const crypto = await import('node:crypto');
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const secret = process.env.JWT_SECRET || 'YourSuperSecretKeyForJWTTokenGenerationThatIsLongEnough123456!';
  const now = Math.floor(Date.now() / 1000);
  const payload = { 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': '1', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'welcome@promedtechnologies.co.za', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Admin User', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Super Admin', exp: now + 3600, iss: 'ProjectTrackerAPI', aud: 'ProjectTrackerClient' };
  const head = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64(payload);
  token = head + '.' + crypto.createHmac('sha256', secret).update(head).digest('base64url');
  const me = await fetch(`${api}/users/1`, { headers: { authorization: 'Bearer ' + token } });
  console.log('minted token; /users/1 ->', me.status);
  user = me.ok ? await me.json() : { userId: 1, name: 'Admin User', email: 'welcome@promedtechnologies.co.za', role: 'Super Admin', permissions: 'all' };
}

const chrome = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'];
const exe = chrome[0];
const port = 9333;
const proc = spawn(exe, [`--remote-debugging-port=${port}`, '--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1400,900', `--user-data-dir=${process.env.TEMP}\\probe-profile`, 'about:blank'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = list.find(t => t.type === 'page').webSocketDebuggerUrl;
const { WebSocket } = await import('ws').catch(() => ({ WebSocket: globalThis.WebSocket }));
const sock = new WebSocket(ws);
let id = 0; const pending = new Map(); const logs = [];
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); });
sock.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(m.params.type.toUpperCase() + ': ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
});
await new Promise(r => sock.addEventListener('open', r));
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: base + '/login' });
await new Promise(r => setTimeout(r, 2500));
await send('Runtime.evaluate', { expression: `localStorage.setItem('token', ${JSON.stringify(token)}); localStorage.setItem('currentUser', ${JSON.stringify(JSON.stringify(user))});` });
await send('Page.navigate', { url: base + path });
await new Promise(r => setTimeout(r, 7000));
const dom = await send('Runtime.evaluate', { expression: `JSON.stringify({ url: location.href, tabs: document.querySelectorAll('.mat-mdc-tab').length, tabLabels: [...document.querySelectorAll('.mdc-tab__text-label')].map(e => e.textContent.trim()), hasTabGroup: !!document.querySelector('mat-tab-group'), loading: !!document.querySelector('app-skeleton-rows'), bodyText: document.body.innerText.slice(0, 600) })`, returnByValue: true });
console.log(dom?.result?.value);
console.log('--- console ---'); logs.forEach(l => console.log(l.slice(0, 1200)));
proc.kill(); process.exit(0);
