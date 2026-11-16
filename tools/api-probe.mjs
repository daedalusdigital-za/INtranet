// Hits the Home business-widget endpoints with a minted admin token and prints a compact summary.
// usage: node tools/api-probe.mjs
const api = 'http://localhost:5143/api';
const crypto = await import('node:crypto');
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const secret = process.env.JWT_SECRET || 'YourSuperSecretKeyForJWTTokenGenerationThatIsLongEnough123456!';
const now = Math.floor(Date.now() / 1000);
const payload = { 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': '1', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'welcome@promedtechnologies.co.za', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Admin User', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Super Admin', exp: now + 3600, iss: 'ProjectTrackerAPI', aud: 'ProjectTrackerClient' };
const head = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64(payload);
const token = head + '.' + crypto.createHmac('sha256', secret).update(head).digest('base64url');
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/home/widgets/payment-tracker', '/home/widgets/currency', '/home/widgets/sales-daily?days=7', '/home/widgets/sales-vs-stock', '/attendance/earliest-today?take=3'];
for (const p of paths) {
  const t0 = Date.now();
  const r = await fetch(api + p, { headers: { authorization: 'Bearer ' + token } });
  const text = await r.text();
  console.log(`${r.status} ${Date.now() - t0}ms ${p}\n  ${text.slice(0, 700)}\n`);
}
