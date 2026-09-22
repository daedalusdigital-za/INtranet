import sql from 'mssql';

const config: sql.config = {
  server: process.env.DB_SERVER || 'database',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME || 'ProjectTrackerDB',
  user: process.env.DB_USER || 'mcp_readonly',
  password: process.env.DB_PASSWORD || 'McpR3ad0nly@2026!',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then((pool: sql.ConnectionPool) => {
        console.log('[db] Connected to SQL Server');
        pool.on('error', (err: unknown) => {
          console.error('[db] Pool error:', err);
          poolPromise = null;
        });
        return pool;
      })
      .catch((err: unknown) => {
        console.error('[db] Connection failed:', err);
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise as Promise<sql.ConnectionPool>;
}

/**
 * Run a parameterized read-only query. This is the ONLY way tools touch the DB.
 * Params are bound via mssql request inputs (never string-concatenated).
 */
export async function query<T = any>(
  text: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const pool = await getPool();
  const request = pool.request();
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value as any);
  }
  const result = await request.query(text);
  return result.recordset as T[];
}

/**
 * Lightweight connectivity probe for /health/db. Returns true if the pool can
 * reach ProjectTrackerDB with a trivial round-trip.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const rows = await query<{ ok: number }>('SELECT 1 AS ok');
    return rows[0]?.ok === 1;
  } catch {
    return false;
  }
}
