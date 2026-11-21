// usage: node tools/portal/api-get.mjs /path [maxChars]
const api = 'http://localhost:5143/api';
const crypto = await import('node:crypto');
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const secret = process.env.JWT_SECRET || 'YourSuperSecretKeyForJWTTokenGenerationThatIsLongEnough123456!';
const now = Math.floor(Date.now() / 1000);
const payload = { 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': '1', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'welcome@promedtechnologies.co.za', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Admin User', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Super Admin', exp: now + 3600, iss: 'ProjectTrackerAPI', aud: 'ProjectTrackerClient' };
const head = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64(payload);
const token = head + '.' + crypto.createHmac('sha256', secret).update(head).digest('base64url');
const [p, max] = process.argv.slice(2);
const r = await fetch(api + p, { headers: { authorization: 'Bearer ' + token } });
const text = await r.text();
let out = text;
try { const j = JSON.parse(text); if (j.breadcrumbs) j.breadcrumbs = `[${j.breadcrumbs.length} points]`; out = JSON.stringify(j, null, 1); } catch {}
console.log(r.status, p); console.log(out.slice(0, Number(max) || 6000));
