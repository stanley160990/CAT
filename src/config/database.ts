/**
 * Konfigurasi Database PostgreSQL
 * 
 * File ini mengelola parameter koneksi database.
 * Mendukung Cloud SQL di AI Studio maupun database PostgreSQL lokal (Docker/VPS/Localhost).
 */

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
}

export function getDatabaseConfig(): DatabaseConfig {
  return {
    // Host database: Gunakan SQL_HOST untuk Cloud SQL atau DB_HOST untuk lokal/Docker
    host: process.env.SQL_HOST || process.env.DB_HOST || 'localhost',
    
    // Port database: Default PostgreSQL 5432
    port: Number(process.env.SQL_PORT || process.env.DB_PORT) || 5432,
    
    // Username database
    user: process.env.SQL_USER || process.env.DB_USER || 'postgres',
    
    // Password database
    password: process.env.SQL_PASSWORD || process.env.DB_PASSWORD || 'postgres123',
    
    // Nama database
    database: process.env.SQL_DB_NAME || process.env.DB_NAME || 'cat_db',
    
    // SSL: false untuk local development / docker
    ssl: process.env.DB_SSL === 'true',
  };
}
