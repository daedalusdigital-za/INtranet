// Drives the LIVE client portal in headless Chrome via CDP: login → Address book → Add → fill → Save.
// Prints every network request to the API, console errors, and what the page shows afterwards.
// usage: node tools/portal-probe.mjs
const base = process.env.PORTAL_URL || 'https://thankful-river-00b68851e.5.azurestaticapps.net';
const email = process.env.PORTAL_EMAIL || 'welcome@rocketfreight.co.za';
const password = process.env.PORTAL_PASSWORD || 'Kingsland2630';
const { spawn } = await import('node:child_process');

const exe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9334;
const proc = spawn(exe, [`--remote-debugging-port=${port}`, '--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1400,900', `--user-data-dir=${process.env.TEMP}\\portal-probe-profile`, 'about:blank'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = list.find(t => t.type === 'page').webSocketDebuggerUrl;
const sock = new WebSocket(ws);
let id = 0; const pending = new Map(); const logs = []; const net = new Map();
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); });
sock.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type !== 'log' && m.params.type !== 'info' && m.params.type !== 'debug') logs.push(m.params.type.toUpperCase() + ': ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
  if (m.method === 'Network.requestWillBeSent' && /api\/portal|googleapis/.test(m.params.request.url)) net.set(m.params.requestId, { m: m.params.request.method, url: m.params.request.url, body: m.params.request.postData, status: '…' });
  if (m.method === 'Network.responseReceived' && net.has(m.params.requestId)) net.get(m.params.requestId).status = m.params.response.status;
  if (m.method === 'Network.loadingFailed' && net.has(m.params.requestId)) net.get(m.params.requestId).status = 'FAILED ' + m.params.errorText + (m.params.blockedReason ? ' ' + m.params.blockedReason : '');
});
await new Promise(r => sock.addEventListener('open', r));
await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))?.result?.value;
const text = async () => evalJs('document.body.innerText.slice(0, 1500)');

// Helper: set an Angular-bound input's value and fire input/change events
const setVal = (sel, v) => evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'MISSING ' + ${JSON.stringify(sel)}; const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; })()`);
const clickText = (t) => evalJs(`(() => { const els = [...document.querySelectorAll('button, a')]; const el = els.find(e => e.textContent.trim().toLowerCase().startsWith(${JSON.stringify(t.toLowerCase())})); if (!el) return 'NO BUTTON ' + ${JSON.stringify(t)} + ' | have: ' + els.map(e => e.textContent.trim()).filter(Boolean).slice(0, 25).join(' / '); el.click(); return 'clicked ' + el.textContent.trim(); })()`);

console.log('1. login page');
await send('Page.navigate', { url: base + '/login' }); await sleep(4000);
console.log('   inputs:', await evalJs(`[...document.querySelectorAll('input')].map(i => i.type + ':' + (i.getAttribute('formcontrolname') || i.name || i.id || i.placeholder)).join(', ')`));
console.log('  ', await setVal('input[type=email], input[formcontrolname=email], input[name=email]', email));
console.log('  ', await setVal('input[type=password]', password));
console.log('  ', await clickText('sign in'));
await sleep(5000);
console.log('   url after login:', await evalJs('location.href'));

console.log('2. address book');
await send('Page.navigate', { url: base + '/addresses' }); await sleep(4000);
console.log('   url:', await evalJs('location.href'));
console.log('   page text:', (await text()).replace(/\n+/g, ' | ').slice(0, 400));
console.log('  ', await clickText('add an address'));
await sleep(2500);
console.log('   editing panel present:', await evalJs(`!!document.querySelector('form')`), ' forms:', await evalJs(`document.querySelectorAll('form').length`), ' pickers:', await evalJs(`document.querySelectorAll('app-address-picker').length`));
console.log('   dialog/section html:', await evalJs(`(document.querySelector('form, dialog, .editor, .panel, app-address-picker')?.outerHTML || '').slice(0, 600)`));
console.log('   form fields:', await evalJs(`[...document.querySelectorAll('input, select, textarea')].map(i => i.tagName.toLowerCase() + ':' + (i.getAttribute('formcontrolname') || i.name || i.type)).join(', ')`));
const fill = { label: 'Probe Depot', street: '5 Probe Street', unit: '', suburb: 'Westville', city: 'Durban', province: 'KwaZulu-Natal', postalCode: '3629', contactName: 'Probe Bot', contactPhone: '0310001111' };
for (const [k, v] of Object.entries(fill)) {
  if (!v) continue;
  console.log(`   set ${k}:`, await setVal(`[formcontrolname=${k}]`, v));
}
console.log('   radio modes:', await evalJs(`[...document.querySelectorAll('input[type=radio]')].map(r => r.value + '=' + r.checked).join(', ')`));
// hook XHR + fetch so we see every send regardless of CDP filtering
await evalJs(`window.__sent = []; const os = XMLHttpRequest.prototype.send, oo = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function(m, u) { this.__m = m; this.__u = u; return oo.apply(this, arguments); }; XMLHttpRequest.prototype.send = function(b) { window.__sent.push(this.__m + ' ' + this.__u + ' ' + (b || '')); return os.apply(this, arguments); }; 'hooked'`);
const compState = () => evalJs(`(() => { const host = document.querySelector('form.editor')?.closest('app-address-book, [class*=address]') || document.querySelector('form.editor')?.parentElement; let c = null; for (let el = document.querySelector('form.editor'); el && !c; el = el.parentElement) { try { c = window.ng?.getComponent(el); } catch {} } if (!c) return 'no component'; return JSON.stringify({ comp: c.constructor?.name, api: c.api?.constructor?.name, apiBase: c.api?.base, editing: c.editing?.(), saving: c.saving?.(), problem: c.problem?.(), formValue: c.form?.getRawValue?.(), formValid: c.form?.valid }); })()`);
console.log('   BEFORE save:', await compState());
console.log('   save button:', await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(b => /save address/i.test(b.textContent)); return b ? b.outerHTML.slice(0, 200) + ' disabled=' + b.disabled : 'none'; })()`));
console.log('  ', await clickText('save address'));
await sleep(1500);
console.log('   AFTER save (1.5s):', await compState());
await sleep(3500);
console.log('   xhr sent:', await evalJs(`JSON.stringify(window.__sent)`));
console.log('   forms now:', await evalJs(`document.querySelectorAll('form.editor').length`), ' toast/problem text:', await evalJs(`[...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /saved|fill in|street|error|wrong|failed/i.test(e.textContent)).map(e => e.className + ':' + e.textContent.trim()).slice(0, 8).join(' || ')`));
console.log('   page text after save:', (await text()).replace(/\n+/g, ' | ').slice(0, 700));
console.log('   problem/error elements:', await evalJs(`[...document.querySelectorAll('.problem, .error, [role=alert], .toast, app-toast')].map(e => e.textContent.trim()).filter(Boolean).join(' || ')`));

console.log('\n--- network (api/portal + google) ---');
for (const r of net.values()) console.log(`${r.status}  ${r.m} ${r.url.replace(base, '')}${r.body ? '  body=' + r.body.slice(0, 300) : ''}`);
console.log('--- console ---'); logs.forEach(l => console.log(l.slice(0, 800)));
proc.kill(); process.exit(0);
