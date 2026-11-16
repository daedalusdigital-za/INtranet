// Print Welly inter-company lanes: node tools/welly-lanes.mjs [days]
const api = 'http://localhost:5143/api';
const crypto = await import('node:crypto');
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const secret = process.env.JWT_SECRET || 'YourSuperSecretKeyForJWTTokenGenerationThatIsLongEnough123456!';
const now = Math.floor(Date.now() / 1000);
const payload = { 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': '1', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'welcome@promedtechnologies.co.za', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Admin User', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Super Admin', exp: now + 3600, iss: 'ProjectTrackerAPI', aud: 'ProjectTrackerClient' };
const head = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64(payload);
const token = head + '.' + crypto.createHmac('sha256', secret).update(head).digest('base64url');
const days = process.argv[2] ?? 45;
const r = await fetch(`${api}/welly/suggestions/fulfilment?days=${days}`, { headers: { authorization: 'Bearer ' + token } });
const j = await r.json();
console.log('summary', JSON.stringify(j.summary));
console.log('flow', JSON.stringify(j.flow));
for (const l of j.interCompany) {
  console.log(`\n${l.from} -> ${l.to}: items=${l.items.length} qty=${l.totalQty} unlocks=${l.unlocksInvoices} (R ${Math.round(l.unlocksValue)}) sameWH=${l.sameWarehouseLines} cross=${l.crossWarehouseLines}`);
  for (const it of l.items.slice(0, 8))
    console.log(`   ${it.name} | ${it.fromCode} -> ${it.toCode} | qty ${it.qty} | ${it.warehouses.join(',')}${it.donorName !== it.name ? ' | donor: ' + it.donorName : ''}`);
}
