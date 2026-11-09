"""End-to-end functional test of the client portal API through the Azure edge, as a real customer login.
Usage: python tools/portal_e2e.py [email] [password]
Covers every call the portal UI makes: login, me, counts, shipments list/filters/search, detail, documents,
address book CRUD, booking validate/create/cancel, notification settings, support thread, change password
(round-trips back), forgot-password, and the negative cases (bad token, foreign resource, non-portal path).
"""
import json, sys, time, urllib.request, urllib.error, urllib.parse
from datetime import date, timedelta

EDGE = "https://app-rocket-portal-edge.azurewebsites.net"
BASE = EDGE + "/api/portal"
EMAIL = sys.argv[1] if len(sys.argv) > 1 else "welcome@rocketfreight.co.za"
PASSWORD = sys.argv[2] if len(sys.argv) > 2 else "Kingsland2630"

results = []
token = None


def call(method, path, body=None, auth=True, raw=False, params=None):
    url = (path if path.startswith("http") else BASE + path)
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    h = {"Content-Type": "application/json", "Origin": "https://thankful-river-00b68851e.5.azurestaticapps.net"}
    if auth and token:
        h["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, method=method, headers=h, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
            ct = r.headers.get("Content-Type", "")
            return r.status, (data if raw else (json.loads(data) if data and "json" in ct else data.decode(errors="replace"))), r.headers
    except urllib.error.HTTPError as e:
        data = e.read()
        try:
            return e.code, json.loads(data), e.headers
        except Exception:
            return e.code, data.decode(errors="replace"), e.headers
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}", {}


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + ("" if not detail else f"  -> {detail}"))


# ---------------------------------------------------------------- 1. login screen
st, b, _ = call("POST", "/auth/login", {"email": EMAIL, "password": "definitely-wrong"}, auth=False)
check("Login · wrong password rejected", st == 401, f"{st} {b}")
st, b, _ = call("POST", "/auth/login", {"email": EMAIL, "password": PASSWORD}, auth=False)
check("Login · correct password", st == 200 and "token" in b, f"{st} user={b.get('user') if isinstance(b, dict) else b}")
if st != 200:
    sys.exit("cannot continue without login")
token = b["token"]
me_login = b["user"]
st, b, _ = call("POST", "/auth/forgot-password", {"email": EMAIL}, auth=False)
check("Login · Forgot password link", st in (200, 202, 204), f"{st} {b}")

# ---------------------------------------------------------------- 2. shell (header / nav)
st, me, _ = call("GET", "/me")
check("Shell · /me loads", st == 200 and me.get("email", "").lower() == EMAIL.lower(), f"{st} {me}")
st, counts, _ = call("GET", "/shipments/counts")
check("Shell · shipment counters", st == 200 and isinstance(counts, dict), f"{st} {counts}")

# ---------------------------------------------------------------- 3. shipments list + filters + search
all_items = []
for f in ["all", "active", "awaiting", "scheduled", "onTheRoad", "attention", "delivered", "closed"]:
    st, page, _ = call("GET", "/shipments", params={"filter": f, "page": 1, "pageSize": 20})
    ok = st == 200 and isinstance(page, dict) and "items" in page
    check(f"Shipments · filter={f}", ok, f"{st} total={page.get('total') if ok else page}")
    if ok and f == "all":
        all_items = page["items"]
st, page, _ = call("GET", "/shipments", params={"filter": "all", "page": 1, "pageSize": 20, "search": "zzz-no-such-ref"})
check("Shipments · search no match returns empty page", st == 200 and page.get("total", -1) == 0, f"{st} {page.get('total') if isinstance(page, dict) else page}")
today = date.today()
st, page, _ = call("GET", "/shipments", params={"filter": "all", "page": 1, "pageSize": 20, "from": (today - timedelta(days=365)).isoformat(), "to": today.isoformat()})
check("Shipments · date range filter", st == 200, f"{st} total={page.get('total') if isinstance(page, dict) else page}")
st, page, _ = call("GET", "/shipments", params={"filter": "all", "page": 999, "pageSize": 20})
check("Shipments · far page returns empty", st == 200 and len(page.get("items", [1])) == 0, f"{st}")

# ---------------------------------------------------------------- 4. address book CRUD
st, addrs, _ = call("GET", "/addresses")
check("Address book · list", st == 200 and isinstance(addrs, list), f"{st} count={len(addrs) if isinstance(addrs, list) else addrs}")
new_addr = {"label": "E2E Test Depot", "street": "12 Test Street", "unit": "Unit 4", "suburb": "Pinetown", "city": "Durban", "province": "KwaZulu-Natal",
            "postalCode": "3610", "contactName": "E2E Bot", "contactPhone": "0310000000", "contactEmail": "e2e@example.com", "lat": -29.81, "lng": 30.86}
st, a1, _ = call("POST", "/addresses", new_addr)
check("Address book · Add address", st == 200 and a1.get("id"), f"{st} {a1}")
addr_id = a1.get("id") if isinstance(a1, dict) else None
st, b, _ = call("POST", "/addresses", {**new_addr, "street": ""})
check("Address book · Add without street rejected", st == 400, f"{st} {b}")
if addr_id:
    st, a2, _ = call("PUT", f"/addresses/{addr_id}", {**new_addr, "label": "E2E Test Depot (edited)", "contactPhone": "0310000001"})
    check("Address book · Edit address", st == 200 and a2.get("label") == "E2E Test Depot (edited)", f"{st} {a2}")
    st, addrs2, _ = call("GET", "/addresses")
    check("Address book · edited row visible in list", st == 200 and any(a["id"] == addr_id for a in addrs2), f"{st}")
st, b, _ = call("PUT", "/addresses/999999999", new_addr)
check("Address book · Edit foreign/unknown id → 404", st == 404, f"{st}")

# ---------------------------------------------------------------- 5. booking form
coll = (today + timedelta(days=2)).isoformat()
delv = (today + timedelta(days=4)).isoformat()
pickup_id = addr_id or (addrs[0]["id"] if addrs else None)
booking = {
    "clientReference": "E2E-" + time.strftime("%H%M%S"),
    "requestedBy": {"name": me.get("name"), "email": EMAIL, "phone": "0310000000"},
    "shipments": [{
        "pickup": {"addressId": pickup_id},
        "delivery": {"address": {"label": "E2E Delivery", "street": "1 Hospital Road", "suburb": "Observatory", "city": "Cape Town", "province": "Western Cape", "postalCode": "7925",
                                  "contactName": "Receiving", "contactPhone": "0210000000"}, "saveToBook": False},
        "collectionDate": coll, "windowFrom": "08:00", "windowTo": "12:00", "deliverBy": delv,
        "fragile": True, "hazardous": False, "instructions": "E2E test booking - please ignore",
        "cargo": [{"type": "parcel", "qty": 2, "weightKg": 5, "lengthCm": 40, "widthCm": 30, "heightCm": 20, "description": "Test cartons"}]
    }]
}
st, v, _ = call("POST", "/bookings/validate", booking)
check("Booking · Validate (good data) ok", st == 200 and v.get("ok") is True, f"{st} {v}")
bad = json.loads(json.dumps(booking)); bad["shipments"][0]["cargo"][0]["weightKg"] = 0; bad["shipments"][0]["collectionDate"] = "2020-01-01"
st, v, _ = call("POST", "/bookings/validate", bad)
check("Booking · Validate (bad data) lists problems with field paths", st == 200 and v.get("ok") is False and v.get("problems") and all("path" in p for p in v["problems"]), f"{st} {v}")
st, v, _ = call("POST", "/bookings", bad)
check("Booking · Submit bad data → 422", st == 422, f"{st}")
st, created, _ = call("POST", "/bookings", booking)
check("Booking · Submit → 201 with bookingNo", st == 201 and created.get("bookingNo"), f"{st} {created}")
new_ship_ids = created.get("shipmentIds", []) if isinstance(created, dict) else []
st, counts2, _ = call("GET", "/shipments/counts")
check("Booking · counters reflect new booking", st == 200 and json.dumps(counts2) != json.dumps(counts), f"before={counts} after={counts2}")
st, page, _ = call("GET", "/shipments", params={"filter": "all", "page": 1, "pageSize": 20, "search": booking["clientReference"]})
check("Shipments · search by client reference finds booking", st == 200 and page.get("total", 0) >= 1, f"{st} total={page.get('total') if isinstance(page, dict) else page}")

# ---------------------------------------------------------------- 6. shipment detail + buttons
detail_ids = new_ship_ids + [i["id"] for i in all_items[:3]]
seen = set(); detail = None
for sid in detail_ids:
    if sid in seen: continue
    seen.add(sid)
    st, d, _ = call("GET", f"/shipments/{sid}")
    check(f"Shipment detail · #{sid} loads", st == 200 and d.get("id") == sid, f"{st} status={d.get('status') if isinstance(d, dict) else d}")
    if st == 200 and detail is None: detail = d
    if st == 200:
        has_events = isinstance(d.get("events"), list)
        check(f"Shipment detail · #{sid} has timeline events", has_events, f"events={len(d.get('events', [])) if has_events else d.get('events')}")
for kind in ["waybill", "labels", "pod"]:
    if not new_ship_ids: break
    st, b, _ = call("GET", f"/shipments/{new_ship_ids[0]}/documents/{kind}")
    check(f"Shipment detail · {kind} button on a just-booked shipment → friendly 404", st == 404 and isinstance(b, dict) and b.get("message"), f"{st} {b}")
# find a shipment that has a waybill to test the real download path
doc_tested = False
for item in all_items:
    st, d, _ = call("GET", f"/shipments/{item['id']}")
    if st != 200: continue
    st, b, _ = call("GET", f"/shipments/{item['id']}/documents/waybill")
    if st == 200 and isinstance(b, dict) and b.get("url"):
        url = b["url"]
        public = url.startswith(EDGE)
        check("Documents · signed waybill URL points at the public edge (not the LAN host)", public, url)
        st2, pdf, hdr = call("GET", url, auth=False, raw=True)
        check("Documents · waybill PDF downloads anonymously via signed link", st2 == 200 and pdf[:4] == b"%PDF", f"{st2} {hdr.get('Content-Type')} {len(pdf) if isinstance(pdf, (bytes, bytearray)) else pdf}")
        st3, _, _ = call("GET", f"/shipments/{item['id']}/documents/labels")
        check("Documents · labels link", st3 == 200, f"{st3}")
        doc_tested = True
        break
if not doc_tested:
    check("Documents · waybill download (no shipment with a waybill exists for this customer yet)", True, "skipped")

st, b, _ = call("GET", "/shipments/999999999")
check("Shipment detail · unknown/foreign id → 404", st == 404, f"{st}")

# cancel button
if new_ship_ids:
    st, c, _ = call("POST", f"/shipments/{new_ship_ids[0]}/cancel", {"reason": "E2E test - cancelling test booking"})
    check("Shipment detail · Cancel shipment button", st == 200 and str(c.get("status", "")).upper().startswith("CANCEL"), f"{st} status={c.get('status') if isinstance(c, dict) else c}")
    st, c2, _ = call("POST", f"/shipments/{new_ship_ids[0]}/cancel", {"reason": "again"})
    check("Shipment detail · Cancel twice is refused", st in (400, 409, 422), f"{st} {c2}")
    st, page, _ = call("GET", "/shipments", params={"filter": "closed", "page": 1, "pageSize": 50})
    check("Shipments · closed filter shows it", st == 200 and any(i["id"] == new_ship_ids[0] for i in page.get("items", [])), f"{st}")

# ---------------------------------------------------------------- 7. settings / notifications
st, prefs, _ = call("GET", "/settings/notifications")
check("Settings · load notification prefs", st == 200 and isinstance(prefs.get("rules"), list) and len(prefs["rules"]) == 8, f"{st} rules={len(prefs.get('rules', [])) if isinstance(prefs, dict) else prefs}")
edited = json.loads(json.dumps(prefs))
for r in edited["rules"]:
    if r["event"] == "ARRIVING": r["email"] = False
edited["extraEmails"] = ["ops-copy@example.com", "bad-email", "ops-copy@example.com"]
st, saved, _ = call("PUT", "/settings/notifications", edited)
arr = next((r for r in saved.get("rules", []) if r["event"] == "ARRIVING"), {}) if isinstance(saved, dict) else {}
check("Settings · Save prefs (toggle + extra emails, dedupe + drop invalid)", st == 200 and arr.get("email") is False and saved.get("extraEmails") == ["ops-copy@example.com"], f"{st} {saved}")
st, again, _ = call("GET", "/settings/notifications")
check("Settings · prefs persist on reload", st == 200 and again.get("extraEmails") == ["ops-copy@example.com"], f"{st}")
st, _, _ = call("PUT", "/settings/notifications", prefs)
check("Settings · restore original prefs", st == 200, f"{st}")

# ---------------------------------------------------------------- 8. support chat
st, th, _ = call("GET", "/support/thread")
check("Support · thread loads", st == 200 and isinstance(th, dict), f"{st} {str(th)[:120]}")
msg_text = "E2E test message " + time.strftime("%H:%M:%S") + " - please ignore"
st, m, _ = call("POST", "/support/thread/messages", {"text": msg_text, "shipmentId": None})
check("Support · Send message", st in (200, 201) and isinstance(m, dict) and m.get("id"), f"{st} {m}")
st, newer, _ = call("GET", "/support/thread/messages", params={"after": str(m.get("id", ""))} if isinstance(m, dict) and m.get("id") else None)
check("Support · poll newer messages", st == 200 and isinstance(newer, list), f"{st} {len(newer) if isinstance(newer, list) else newer}")
st, th2, _ = call("GET", "/support/thread")
msgs = th2.get("messages", []) if isinstance(th2, dict) else []
check("Support · sent message appears in thread", any(x.get("text") == msg_text for x in msgs), f"count={len(msgs)}")
st, b, _ = call("POST", "/support/thread/messages", {"text": "   "})
check("Support · blank message rejected", st == 400, f"{st} {b}")

# ---------------------------------------------------------------- 9. change password (and back)
st, b, _ = call("POST", "/auth/change-password", {"currentPassword": "wrong-current", "newPassword": "Temp-Pass-12345"})
check("Account · change password with wrong current → 400/401", st in (400, 401), f"{st} {b}")
st, b, _ = call("POST", "/auth/change-password", {"currentPassword": PASSWORD, "newPassword": "Temp-Pass-12345"})
check("Account · change password", st in (200, 204), f"{st} {b}")
if st in (200, 204):
    st, b, _ = call("POST", "/auth/login", {"email": EMAIL, "password": "Temp-Pass-12345"}, auth=False)
    check("Account · login with new password", st == 200, f"{st}")
    if st == 200:
        token = b["token"]
    st, b, _ = call("POST", "/auth/change-password", {"currentPassword": "Temp-Pass-12345", "newPassword": PASSWORD})
    check("Account · password restored to original", st in (200, 204), f"{st} {b}")

# ---------------------------------------------------------------- 10. cleanup + security
if addr_id:
    st, _, _ = call("DELETE", f"/addresses/{addr_id}")
    check("Address book · Delete address", st == 204, f"{st}")
    st, addrs3, _ = call("GET", "/addresses")
    check("Address book · deleted row gone from list", st == 200 and not any(a["id"] == addr_id for a in addrs3), f"{st}")
saved_tok = token; token = "garbage.token.value"
st, _, _ = call("GET", "/me")
check("Security · bad bearer → 401", st == 401, f"{st}")
token = None
st, _, _ = call("GET", "/shipments")
check("Security · no bearer → 401", st == 401, f"{st}")
token = saved_tok
st, _, _ = call("GET", EDGE + "/api/users")
check("Security · intranet endpoint not reachable via edge → 404", st == 404, f"{st}")
st, _, _ = call("GET", EDGE + "/api/logistics/portal/users")
check("Security · ops portal-admin endpoint not reachable via edge → 404", st == 404, f"{st}")
req = urllib.request.Request(BASE + "/auth/login", method="OPTIONS", headers={"Origin": "https://thankful-river-00b68851e.5.azurestaticapps.net", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,authorization"})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        st, h = r.status, r.headers
except urllib.error.HTTPError as e:
    st, h = e.code, e.headers
check("Security · CORS preflight from SWA origin", st in (200, 204) and h.get("Access-Control-Allow-Origin"), f"{st} ACAO={h.get('Access-Control-Allow-Origin')}")

# ---------------------------------------------------------------- summary
print("\n==== SUMMARY ====")
fails = [r for r in results if not r[1]]
print(f"{len(results) - len(fails)} passed, {len(fails)} failed")
for n, _, d in fails:
    print(f"  FAIL {n}: {d}")
