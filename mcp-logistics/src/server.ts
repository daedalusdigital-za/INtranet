import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools } from './tools.js';
import { healthCheck } from './db.js';

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '8080', 10);
// Optional fixed public base URL. If unset (e.g. random trycloudflare hostname),
// the base URL is derived per-request from the proxy headers instead.
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
// The single shared password a user must type on the Claude OAuth consent screen.
// No default: the server refuses to start without a real, reasonably long one.
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || '';
const MIN_PASSWORD_LENGTH = 12;
const PLACEHOLDER_PASSWORDS = new Set(['change-me-please', 'please-set-a-long-random-password']);
if (!ACCESS_PASSWORD || PLACEHOLDER_PASSWORDS.has(ACCESS_PASSWORD) || ACCESS_PASSWORD.length < MIN_PASSWORD_LENGTH) {
  console.error(
    `[mcp] FATAL: ACCESS_PASSWORD is unset, a placeholder, or shorter than ${MIN_PASSWORD_LENGTH} characters. ` +
      'Set a long random value (docker-compose: MCP_ACCESS_PASSWORD in the root .env) and restart.'
  );
  process.exit(1);
}
const ACCESS_PASSWORD_HASH = sha256(ACCESS_PASSWORD);

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const AUTH_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes, single use
const MAX_CLIENTS = 200; // oldest registration is evicted beyond this
const MAX_REDIRECT_URIS_PER_CLIENT = 10;
const MAX_FAILED_LOGINS = 5; // per client IP ...
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000; // ... per 15 minutes
const MAX_REGISTRATIONS = 20; // per client IP ...
const REGISTRATION_WINDOW_MS = 60 * 60 * 1000; // ... per hour

// Redirect URIs a dynamically-registered client may use. Claude (web) uses the
// fixed callbacks below; Claude Desktop / Claude Code use a loopback listener on
// a random port. Extra HTTPS prefixes can be allowed via ALLOWED_REDIRECT_URIS.
const DEFAULT_REDIRECT_URIS = new Set([
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
]);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);
const EXTRA_REDIRECT_PREFIXES = (process.env.ALLOWED_REDIRECT_URIS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((prefix) => {
    try {
      if (new URL(prefix).protocol === 'https:') return true;
    } catch {
      /* fall through */
    }
    console.warn(`[mcp] Ignoring ALLOWED_REDIRECT_URIS entry (must be an absolute https:// URL): ${prefix}`);
    return false;
  });

// Build the externally-visible base URL for this request. Honours a fixed
// PUBLIC_URL when set; otherwise uses the (Cloudflare) forwarded proto + host,
// so a random trycloudflare URL works automatically.
function baseUrl(req: Request): string {
  if (PUBLIC_URL) return PUBLIC_URL;
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

// Real client IP behind the Cloudflare tunnel: CF-Connecting-IP (set by
// Cloudflare), else the first X-Forwarded-For hop, else the socket address.
function clientIp(req: Request): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return cf.trim();
  const xff = req.headers['x-forwarded-for'];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
  return first || req.ip || req.socket.remoteAddress || 'unknown';
}

// -----------------------------------------------------------------------------
// In-memory OAuth stores (single-server; fine for a home/office connector)
// -----------------------------------------------------------------------------
interface OAuthClient {
  client_id: string;
  client_secret?: string;
  redirect_uris: string[];
}
interface AuthCode {
  clientId: string;
  redirectUri: string;
  codeChallenge: string; // always S256
  expiresAt: number;
}
const clients = new Map<string, OAuthClient>();
const authCodes = new Map<string, AuthCode>();
const accessTokens = new Map<string, { expiresAt: number }>();

// Fixed-window counter keyed by client IP (no external dependency).
class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private max: number, private windowMs: number, private maxKeys = 10_000) {}
  // Seconds until the window resets if the key is over the limit, else 0.
  blockedFor(key: string): number {
    const e = this.hits.get(key);
    if (!e || e.resetAt <= Date.now() || e.count < this.max) return 0;
    return Math.ceil((e.resetAt - Date.now()) / 1000);
  }
  hit(key: string): void {
    const now = Date.now();
    const e = this.hits.get(key);
    if (e && e.resetAt > now) {
      e.count++;
      return;
    }
    this.hits.delete(key);
    if (this.hits.size >= this.maxKeys) this.sweep();
    if (this.hits.size >= this.maxKeys) this.hits.delete(this.hits.keys().next().value as string);
    this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
  }
  reset(key: string): void {
    this.hits.delete(key);
  }
  sweep(): void {
    const now = Date.now();
    for (const [k, e] of this.hits) if (e.resetAt <= now) this.hits.delete(k);
  }
}
const failedLogins = new RateLimiter(MAX_FAILED_LOGINS, FAILED_LOGIN_WINDOW_MS);
const registrations = new RateLimiter(MAX_REGISTRATIONS, REGISTRATION_WINDOW_MS);

// Periodically drop expired codes/tokens/rate-limit entries so memory stays bounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of authCodes) if (v.expiresAt < now) authCodes.delete(k);
  for (const [k, v] of accessTokens) if (v.expiresAt < now) accessTokens.delete(k);
  failedLogins.sweep();
  registrations.sweep();
}, 60 * 1000).unref();

function b64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function sha256(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}
// Constant-time string comparison (hashing first makes the lengths equal).
function safeEqual(a: string, b: string): boolean {
  return crypto.timingSafeEqual(sha256(a), sha256(b));
}
// PKCE: only S256 is accepted (RFC 7636 / OAuth 2.1).
function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return safeEqual(b64url(sha256(verifier)), challenge);
}
// Request params may arrive as arrays/objects (?a=1&a=2); only accept plain strings.
function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

// A redirect URI is allowed if it is one of Claude's callbacks, an http loopback
// URL (any port), or starts with an operator-configured ALLOWED_REDIRECT_URIS prefix.
function isAllowedRedirectUri(uri: string): boolean {
  if (!uri || uri.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (DEFAULT_REDIRECT_URIS.has(url.href)) return true;
  if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) return true;
  return EXTRA_REDIRECT_PREFIXES.some((prefix) => {
    if (!url.href.startsWith(prefix)) return false;
    // Prefix must end on a boundary so "https://a.com" does not match "https://a.com.evil.net".
    if (url.href.length === prefix.length || prefix.endsWith('/')) return true;
    return '/?'.includes(url.href[prefix.length]);
  });
}

// -----------------------------------------------------------------------------
// HTML pages (consent + errors). Every interpolated value goes through escapeHtml.
// -----------------------------------------------------------------------------
function sendHtml(res: Response, status: number, inner: string) {
  res.status(status);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // No form-action directive: Chrome applies it to the post-submit redirect to Claude.
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'");
  res.send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Rocket Freight Logistics — Connect Claude</title>
  <style>body{font-family:system-ui,Segoe UI,Arial;background:#0f172a;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  .card{background:#1e293b;padding:32px;border-radius:14px;max-width:360px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.4)}
  h1{font-size:18px;margin:0 0 6px}p{color:#94a3b8;font-size:13px;margin:0 0 18px}.err{color:#fca5a5}
  input{width:100%;padding:12px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;box-sizing:border-box}
  button{width:100%;margin-top:14px;padding:12px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:600;cursor:pointer}</style>
  </head><body>${inner}</body></html>`);
}

function sendErrorPage(res: Response, status: number, message: string) {
  sendHtml(res, status, `<div class="card"><h1>Cannot connect Claude</h1><p class="err">${escapeHtml(message)}</p></div>`);
}

interface AuthorizeParams {
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
}

function sendConsentPage(res: Response, status: number, p: AuthorizeParams, error = '') {
  const redirectHost = new URL(p.redirect_uri).host;
  sendHtml(res, status, `<form class="card" method="post" action="/authorize">
  <h1>Connect Claude to Logistics</h1>
  <p>Enter the access password to grant Claude read-only access to logistics data.</p>
  <p>You will be returned to <strong>${escapeHtml(redirectHost)}</strong>.</p>
  ${error ? `<p class="err">${escapeHtml(error)}</p>` : ''}
  <input type="password" name="password" placeholder="Access password" autofocus required />
  <input type="hidden" name="client_id" value="${escapeHtml(p.client_id)}" />
  <input type="hidden" name="redirect_uri" value="${escapeHtml(p.redirect_uri)}" />
  <input type="hidden" name="state" value="${escapeHtml(p.state)}" />
  <input type="hidden" name="code_challenge" value="${escapeHtml(p.code_challenge)}" />
  <input type="hidden" name="code_challenge_method" value="${escapeHtml(p.code_challenge_method)}" />
  <button type="submit">Authorize</button>
  </form>`);
}

// Redirect back to a *validated* redirect_uri with an OAuth error (RFC 6749 §4.1.2.1).
function redirectWithError(res: Response, p: AuthorizeParams, error: string, description: string) {
  const url = new URL(p.redirect_uri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  if (p.state) url.searchParams.set('state', p.state);
  res.redirect(url.toString());
}

// Shared /authorize validation. Returns true if a response has already been sent.
// client_id must be registered and redirect_uri must exactly match one of its
// registered URIs — otherwise show an error page and never redirect.
function rejectAuthorizeRequest(res: Response, p: AuthorizeParams, responseType?: string): boolean {
  const client = p.client_id ? clients.get(p.client_id) : undefined;
  if (!client) {
    sendErrorPage(res, 400, 'Unknown client. Remove and re-add the connector in Claude, then try again.');
    return true;
  }
  if (!p.redirect_uri || !client.redirect_uris.includes(p.redirect_uri)) {
    sendErrorPage(res, 400, 'The redirect_uri does not match any URI registered for this client.');
    return true;
  }
  if (responseType !== undefined && responseType !== 'code') {
    redirectWithError(res, p, 'unsupported_response_type', 'Only response_type=code is supported');
    return true;
  }
  if (p.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(p.code_challenge)) {
    redirectWithError(res, p, 'invalid_request', 'PKCE with code_challenge_method=S256 is required');
    return true;
  }
  return false;
}

function authorizeParams(src: Record<string, unknown>): AuthorizeParams {
  return {
    client_id: str(src.client_id),
    redirect_uri: str(src.redirect_uri),
    state: str(src.state),
    code_challenge: str(src.code_challenge),
    code_challenge_method: str(src.code_challenge_method),
  };
}

function sendLockedOut(res: Response, retryAfter: number) {
  res.setHeader('Retry-After', String(retryAfter));
  sendErrorPage(res, 429, `Too many failed attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`);
}

// -----------------------------------------------------------------------------
// Express app
// -----------------------------------------------------------------------------
const app = express();
app.set('trust proxy', true);
// CORS: any origin may call the API endpoints, but credentials (cookies) are
// never allowed — /mcp is protected by a bearer token the caller must already
// hold, so "*" exposes nothing. The HTML /authorize page gets no CORS headers,
// so other sites cannot read its responses via fetch().
const corsMiddleware = cors({ origin: '*', credentials: false, exposedHeaders: ['Mcp-Session-Id', 'WWW-Authenticate'] });
app.use((req, res, next) => (req.path === '/authorize' ? next() : corsMiddleware(req, res, next)));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Deeper probe: confirms the SQL pool can reach ProjectTrackerDB.
app.get('/health/db', async (_req, res) => {
  const ok = await healthCheck();
  res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'db_unreachable', database: ok });
});

// ---- OAuth discovery metadata ----------------------------------------------
app.get('/.well-known/oauth-protected-resource', (req, res) => {
  const base = baseUrl(req);
  res.json({
    resource: base,
    authorization_servers: [base],
  });
});
// Some clients probe the resource-specific variant.
app.get('/.well-known/oauth-protected-resource/mcp', (req, res) => {
  const base = baseUrl(req);
  res.json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
  });
});

app.get('/.well-known/oauth-authorization-server', (req, res) => {
  const base = baseUrl(req);
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    scopes_supported: ['logistics.read'],
  });
});

// ---- Dynamic Client Registration (RFC 7591) --------------------------------
app.post('/register', (req, res) => {
  const ip = clientIp(req);
  const retryAfter = registrations.blockedFor(ip);
  if (retryAfter) {
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'too_many_requests', error_description: 'Too many client registrations' });
  }
  registrations.hit(ip);

  const raw: unknown = req.body?.redirect_uris;
  const redirectUris = Array.isArray(raw) ? raw : [];
  if (
    redirectUris.length === 0 ||
    redirectUris.length > MAX_REDIRECT_URIS_PER_CLIENT ||
    !redirectUris.every((u) => typeof u === 'string' && isAllowedRedirectUri(u))
  ) {
    return res.status(400).json({
      error: 'invalid_redirect_uri',
      error_description:
        `redirect_uris must be 1-${MAX_REDIRECT_URIS_PER_CLIENT} allowed URIs: https://claude.ai/api/mcp/auth_callback, ` +
        'https://claude.com/api/mcp/auth_callback, http://localhost:<port>/..., http://127.0.0.1:<port>/... ' +
        'or an ALLOWED_REDIRECT_URIS prefix',
    });
  }

  // Cap memory: evict the oldest registration (Map keeps insertion order).
  while (clients.size >= MAX_CLIENTS) clients.delete(clients.keys().next().value as string);
  const clientId = randomUUID();
  const client: OAuthClient = { client_id: clientId, redirect_uris: redirectUris as string[] };
  clients.set(clientId, client);
  res.status(201).json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: client.redirect_uris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code'],
    response_types: ['code'],
  });
});

// ---- Authorization endpoint ------------------------------------------------
// GET renders a tiny password gate; POST issues the authorization code.
app.get('/authorize', (req, res) => {
  const p = authorizeParams(req.query as Record<string, unknown>);
  const responseType = req.query.response_type === undefined ? undefined : str(req.query.response_type);
  if (rejectAuthorizeRequest(res, p, responseType)) return;
  sendConsentPage(res, 200, p);
});

app.post('/authorize', (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const p = authorizeParams(body);
  if (rejectAuthorizeRequest(res, p)) return;

  const ip = clientIp(req);
  const lockedFor = failedLogins.blockedFor(ip);
  if (lockedFor) return sendLockedOut(res, lockedFor);

  // Timing-safe compare: hash both sides so lengths match, then timingSafeEqual.
  const password = str(body.password);
  if (!password || !crypto.timingSafeEqual(sha256(password), ACCESS_PASSWORD_HASH)) {
    failedLogins.hit(ip);
    const nowLockedFor = failedLogins.blockedFor(ip);
    if (nowLockedFor) {
      console.warn(`[mcp] /authorize: ${ip} locked out after ${MAX_FAILED_LOGINS} failed password attempts`);
      return sendLockedOut(res, nowLockedFor);
    }
    return sendConsentPage(res, 401, p, 'Incorrect password. Please try again.');
  }
  failedLogins.reset(ip);

  const code = b64url(crypto.randomBytes(32));
  authCodes.set(code, {
    clientId: p.client_id,
    redirectUri: p.redirect_uri,
    codeChallenge: p.code_challenge,
    expiresAt: Date.now() + AUTH_CODE_TTL_MS,
  });
  const url = new URL(p.redirect_uri);
  url.searchParams.set('code', code);
  if (p.state) url.searchParams.set('state', p.state);
  res.redirect(url.toString());
});

// ---- Token endpoint --------------------------------------------------------
app.post('/token', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const body = (req.body || {}) as Record<string, unknown>;
  const grant_type = str(body.grant_type);
  const code = str(body.code);
  const code_verifier = str(body.code_verifier);
  const client_id = str(body.client_id);
  const redirect_uri = str(body.redirect_uri);
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }
  const entry = code ? authCodes.get(code) : undefined;
  // Single use: burn the code on first presentation, even if this request fails.
  if (code) authCodes.delete(code);
  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  if (!client_id || client_id !== entry.clientId) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'client_id does not match the authorization code' });
  }
  if (!redirect_uri || redirect_uri !== entry.redirectUri) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri does not match the authorization request' });
  }
  const client = clients.get(entry.clientId);
  if (!client || (client.client_secret && !safeEqual(str(body.client_secret), client.client_secret))) {
    return res.status(401).json({ error: 'invalid_client' });
  }
  if (!code_verifier || !verifyPkceS256(code_verifier, entry.codeChallenge)) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE check failed' });
  }
  const accessToken = b64url(crypto.randomBytes(32));
  accessTokens.set(accessToken, { expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000 });
  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: TOKEN_TTL_SECONDS,
    scope: 'logistics.read',
  });
});

// ---- Bearer auth middleware for the MCP endpoint ---------------------------
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const entry = token ? accessTokens.get(token) : undefined;
  if (!entry || entry.expiresAt < Date.now()) {
    res.setHeader(
      'WWW-Authenticate',
      `Bearer resource_metadata="${baseUrl(req)}/.well-known/oauth-protected-resource"`
    );
    return res.status(401).json({ error: 'invalid_token' });
  }
  next();
}

// -----------------------------------------------------------------------------
// MCP endpoint (stateless Streamable HTTP — new server/transport per request)
// -----------------------------------------------------------------------------
app.post('/mcp', requireAuth, async (req, res) => {
  const server = new McpServer({ name: 'intranet-logistics', version: '1.0.0' });
  registerTools(server);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp] request error:', err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
    }
  }
});

// GET/DELETE on /mcp are not used in stateless mode.
app.get('/mcp', requireAuth, (_req, res) => res.status(405).json({ error: 'method_not_allowed' }));
app.delete('/mcp', requireAuth, (_req, res) => res.status(405).json({ error: 'method_not_allowed' }));

app.listen(PORT, () => {
  console.log(`[mcp] Logistics MCP server listening on :${PORT}`);
  console.log(`[mcp] Public URL: ${PUBLIC_URL || '(derived per-request from proxy headers)'}`);
  console.log(`[mcp] MCP endpoint path: /mcp`);
  if (EXTRA_REDIRECT_PREFIXES.length) {
    console.log(`[mcp] Extra allowed redirect URI prefixes: ${EXTRA_REDIRECT_PREFIXES.join(', ')}`);
  }
});
