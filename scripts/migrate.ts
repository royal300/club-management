// Applies pending SQL migrations from ./drizzle. Safe to run on every deploy.
import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const conn = await mysql.createConnection({ uri: url, multipleStatements: true });
  await migrate(drizzle(conn), { migrationsFolder: "./drizzle" });
  console.log("✓ migrations applied");
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
