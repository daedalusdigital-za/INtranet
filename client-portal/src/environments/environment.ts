// Production: talks to the INtranet backend's portal API through the Azure edge
// (portal-edge/ → Hybrid Connection → on-prem API). Only /api/portal/* is reachable
// from the internet; everything else on the intranet API stays LAN-only.
//
// The CI workflow (.github/workflows/client-portal-swa.yml) replaces the
// __PORTAL_API_BASE__ / __PORTAL_GOOGLE_MAPS_KEY__ markers from GitHub repository
// variables before the build, so hostnames and keys live in GitHub, not in source.
export const environment = {
  production: true,
  apiBase: '__PORTAL_API_BASE__',
  useMock: false,
  useHashRouting: false,
  supportPhone: '021 000 0000',
  supportPhoneIntl: '+27210000000',
  supportEmail: 'support@rocketfreight.co.za',
  googleMapsKey: '__PORTAL_GOOGLE_MAPS_KEY__',
  brandName: 'Rocket Freight',
};
