import "server-only";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { clubPool?: mysql.Pool };

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = mysql.createPool({
    uri: url,
    connectionLimit: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    timezone: "Z",
    decimalNumbers: false,
    supportBigNumbers: true,
    charset: "utf8mb4",
  });
  // Keep the session clock in UTC so any server-side NOW() agrees with app-written timestamps.
  pool.pool.on("connection", (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  return pool;
}

const pool = globalForDb.clubPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.clubPool = pool;

export const db = drizzle(pool, { schema, mode: "default" });
export type DB = typeof db;
export { schema };
