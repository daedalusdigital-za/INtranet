# Freight Portal – client front end

Angular 21 client portal for booking and tracking road shipments. It talks only to the
`/api/portal` endpoints listed below. The customer is always taken from the login token,
never from a request parameter.

## Run it

```bash
npm install            # .npmrc sets legacy-peer-deps
npm start              # http://localhost:4200, demo data, no backend needed
npm run build          # production build → dist/client-portal/browser
npx ng build --configuration demo   # demo build with mock data
```

| Environment file | Used by | Data |
| --- | --- | --- |
| `src/environments/environment.ts` | `npm run build` (production) | Real API at `apiBase` |
| `src/environments/environment.demo.ts` | `npm start`, `--configuration demo` | In-memory mock (`MockPortalApi`) |

Settings: `apiBase`, `useMock`, `useHashRouting` (keep `false` in production and serve
`index.html` for unknown paths), `supportPhone`, `supportPhoneIntl`, `supportEmail` (shown in the footer, sign-in page and chat), `googleMapsKey` (browser key restricted to the portal domain,
with Maps JavaScript API and Places API (New) enabled; empty = typed addresses only), `brandName`.

## Structure

```
src/app/
  core/
    models.ts            API contract: every request and response shape
    portal-api.ts        Abstract API, one method per endpoint
    http-portal-api.ts   Real implementation (HttpClient)
    mock-portal-api.ts   Demo data
    booking-rules.ts     Booking validation, mirrors the server rules
    status.ts            Client-facing status names, filters, notification labels
    auth.*               Session, route guard, bearer-token interceptor (401 → sign out)
    address-lookup.ts    Google Places (South Africa only) / demo / none
    errors.ts, toast.service.ts
  shared/
    route-strip.ts       The road-style progress strip (full and compact)
    status-chip.ts
  features/
    login, shell, shipments, shipment-detail, booking, address-book, settings
src/styles.scss          Design tokens and shared styles; restyle here
```

## Endpoints the backend must provide

All under `/api/portal`, JSON, bearer token except login and forgot-password.
Shapes are in `core/models.ts`.

| Method and path | Request | Response |
| --- | --- | --- |
| `POST /auth/login` | `{email, password}` | `LoginResponse`; 401 wrong details; 429 rate limited |
| `POST /auth/forgot-password` | `{email}` | 204 always (never reveal if the email exists) |
| `GET /me` | | `ClientUser` |
| `GET /shipments/counts` | | `ShipmentCounts` |
| `GET /shipments` | `filter, search, from, to, page, pageSize` | `Page<ShipmentSummary>` |
| `GET /shipments/{id}` | | `ShipmentDetail`; 404 if not this customer’s |
| `POST /shipments/{id}/cancel` | `{reason}` | `ShipmentDetail`; 409 unless BOOKED or CONFIRMED |
| `POST /bookings/validate` | `BookingRequest` | `ValidationResult` (nothing saved) |
| `POST /bookings` | `BookingRequest` | 201 `BookingResult`; 422 `{problems: ValidationProblem[]}` |
| `GET /addresses` | | `Address[]` |
| `POST /addresses`, `PUT /addresses/{id}` | `Address` | `Address` |
| `DELETE /addresses/{id}` | | 204 |
| `GET /settings/notifications` | | `NotificationPrefs` |
| `PUT /settings/notifications` | `NotificationPrefs` | `NotificationPrefs` |
| `GET /shipments/{id}/documents/{waybill or labels or pod}` | | `{url}` short-lived signed PDF link |
| `GET /support/thread` | | `SupportThread` (the user’s conversation, created on first use, with opening hours and whether an agent is online) |
| `POST /support/thread/messages` | `{text, shipmentId?}` | `SupportMessage` as stored |
| `GET /support/thread/messages?after={id}` | | `SupportMessage[]` newer than that id (polled every 4 s while the chat is open, 30 s while closed) |

### Rules for the backend

- Map these onto the existing services behind `/api/logistics/bookings` and
  `/api/logistics/shipments`; `POST /bookings` should call the same validation as the ops
  New booking dialog, with `source = portal`.
- Filter every query by the customer id from the token. `customerId` must not be accepted
  as a parameter.
- Return client-safe data only: no internal notes, driver names or phone numbers, load
  numbers, other customers’ stops or load weights.
- `ShipmentDetail.events[].text` is client wording. Map driver reason codes to plain text in
  `problem` (for example `CLOSED` → “The delivery site was closed when the driver arrived…”).
- `tracking` is only filled while COLLECTED, IN_TRANSIT or ARRIVING; `progress` (0–1) and
  `kmRemaining` come from Cartrack once the geofence and ETA phase is live. Until then,
  leave `tracking` out or send position and `updatedAt` only.
- `canCancel` is true only for BOOKED and CONFIRMED.
- Booking cut-offs (same-day cut-off, lead time, public holidays) are enforced by the server
  and returned as `ValidationProblem`s.
- Rate-limit login and booking; lock out after repeated failed logins.
- `ValidationProblem.path` uses the form’s paths, e.g. `shipments[0].cargo[1].weightKg`, so
  the form can mark the field.

### Support chat

The Help bubble (bottom right of every signed-in page) is `features/support/support-chat.ts`.

- One conversation per client user; staff see every client’s conversations in an intranet inbox with the
  customer, the user and, when sent, the shipment (`shipmentId`, checked to belong to that customer).
- Staff replies are stored as `from: "agent"` with the agent’s first name only.
- Email the client a copy of an agent reply if it is not read in the portal within 10 minutes.
- Polling keeps the backend simple. Swap `supportMessagesAfter` for WebSockets or server-sent events later
  without changing the screen. A hosted chat tool (Intercom, Freshchat, Zendesk) can replace the whole
  component instead; pass it the signed-in user and customer.
- Keep chat history under POPIA: same retention as shipment records, no ID numbers or bank details in chat.

## Notes for the team

- Change detection is zoneless (Angular 21 default). Pages hold their state in signals;
  the booking form bumps a `version` signal on form changes so the view re-renders.
- Session token is kept in `sessionStorage`. If the backend issues an httpOnly cookie
  instead, remove the token handling in `auth.service.ts` and `auth.interceptor.ts`.
- Production builds inline Google Fonts at build time and need internet access on the
  build machine; set `optimization.fonts` to `false` in `angular.json` if they don’t.
- The mobile app can use the same `/api/portal` endpoints.
