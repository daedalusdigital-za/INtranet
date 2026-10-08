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
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || 'change-me-please';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Build the externally-visible base URL for this request. Honours a fixed
// PUBLIC_URL when set; otherwise uses the (Cloudflare) forwarded proto + host,
// so a random trycloudflare URL works automatically.
function baseUrl(req: Request): string {
  if (PUBLIC_URL) return PUBLIC_URL;
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
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
  codeChallenge: string;
  codeChallengeMethod: string;
  expiresAt: number;
}
const clients = new Map<string, OAuthClient>();
const authCodes = new Map<string, AuthCode>();
const accessTokens = new Map<string, { expiresAt: number }>();

function b64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function verifyPkce(verifier: string, challenge: string, method: string): boolean {
  if (method === 'S256') {
    const hash = b64url(crypto.createHash('sha256').update(verifier).digest());
    return hash === challenge;
  }
  return verifier === challenge; // "plain"
}

// -----------------------------------------------------------------------------
// Express app
// -----------------------------------------------------------------------------
const app = express();
app.set('trust proxy', true);
app.use(cors({ exposedHeaders: ['Mcp-Session-Id', 'WWW-Authenticate'] }));
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
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    scopes_supported: ['logistics.read'],
  });
});

// ---- Dynamic Client Registration (RFC 7591) --------------------------------
app.post('/register', (req, res) => {
  const redirectUris: string[] = req.body?.redirect_uris || [];
  const clientId = randomUUID();
  const client: OAuthClient = { client_id: clientId, redirect_uris: redirectUris };
  clients.set(clientId, client);
  res.status(201).json({
    client_id: clientId,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code'],
    response_types: ['code'],
  });
});

// ---- Authorization endpoint ------------------------------------------------
// GET renders a tiny password gate; POST issues the authorization code.
app.get('/authorize', (req, res) => {
  const { client_id, redirect_uri, state, code_challenge, code_challenge_method } = req.query as Record<string, string>;
  if (!client_id || !redirect_uri) {
    return res.status(400).send('Missing client_id or redirect_uri');
  }
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Rocket Freight Logistics — Connect Claude</title>
  <style>body{font-family:system-ui,Segoe UI,Arial;background:#0f172a;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  .card{background:#1e293b;padding:32px;border-radius:14px;max-width:360px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.4)}
  h1{font-size:18px;margin:0 0 6px}p{color:#94a3b8;font-size:13px;margin:0 0 18px}
  input{width:100%;padding:12px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;box-sizing:border-box}
  button{width:100%;margin-top:14px;padding:12px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:600;cursor:pointer}</style>
  </head><body><form class="card" method="post" action="/authorize">
  <h1>Connect Claude to Logistics</h1>
  <p>Enter the access password to grant Claude read-only access to logistics data.</p>
  <input type="password" name="password" placeholder="Access password" autofocus required />
  <input type="hidden" name="client_id" value="${client_id}" />
  <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
  <input type="hidden" name="state" value="${state || ''}" />
  <input type="hidden" name="code_challenge" value="${code_challenge || ''}" />
  <input type="hidden" name="code_challenge_method" value="${code_challenge_method || 'plain'}" />
  <button type="submit">Authorize</button>
  </form></body></html>`);
});

app.post('/authorize', (req, res) => {
  const { password, client_id, redirect_uri, state, code_challenge, code_challenge_method } = req.body as Record<string, string>;
  if (password !== ACCESS_PASSWORD) {
    return res.status(401).send('Incorrect password. Go back and try again.');
  }
  const code = b64url(crypto.randomBytes(32));
  authCodes.set(code, {
    clientId: client_id,
    redirectUri: redirect_uri,
    codeChallenge: code_challenge || '',
    codeChallengeMethod: code_challenge_method || 'plain',
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  const url = new URL(redirect_uri);
  url.searchParams.set('code', code);
  if (state) url.searchParams.set('state', state);
  res.redirect(url.toString());
});

// ---- Token endpoint --------------------------------------------------------
app.post('/token', (req, res) => {
  const { grant_type, code, code_verifier } = req.body as Record<string, string>;
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }
  const entry = code ? authCodes.get(code) : undefined;
  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  authCodes.delete(code);
  if (entry.codeChallenge) {
    if (!code_verifier || !verifyPkce(code_verifier, entry.codeChallenge, entry.codeChallengeMethod)) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE check failed' });
    }
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
  if (ACCESS_PASSWORD === 'change-me-please') {
    console.warn('[mcp] WARNING: ACCESS_PASSWORD is still the default — set a strong one!');
  }
});
