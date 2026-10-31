import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const host = process.env.SQL_HOST || process.env.DB_HOST || 'localhost';
    const port = Number(process.env.SQL_PORT || process.env.DB_PORT) || 5432;
    const user = process.env.SQL_USER || process.env.DB_USER || 'postgres';
    const password = process.env.SQL_PASSWORD || process.env.DB_PASSWORD || '';
    const database = process.env.SQL_DB_NAME || process.env.DB_NAME || 'cat_db';

    global._postgresPool = new Pool({
      host,
      port,
      user,
      password,
      database,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
