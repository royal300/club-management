import { execFileSync } from "node:child_process";
import mysql from "mysql2/promise";
import { E2E } from "./env";

/** Fresh, seeded `club_test` database for every local run. */
export default async function globalSetup() {
  const dbName = new URL(E2E.dbUrl).pathname.slice(1);
  const appUser = decodeURIComponent(new URL(E2E.dbUrl).username);
  const conn = await mysql.createConnection({ uri: E2E.adminUrl, multipleStatements: true });
  await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\`; CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await conn.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${appUser}'@'%'; FLUSH PRIVILEGES;`);
  await conn.end();
  const env = {
    ...process.env,
    DATABASE_URL: E2E.dbUrl,
    SEED_ADMIN_EMAIL: E2E.admin.email,
    SEED_ADMIN_PASSWORD: E2E.admin.password,
    SEED_ADMIN_NAME: "Ananya Sen",
    SEED_DEMO_DATA: "true",
    SEED_DEMO_USERS: "true",
  };
  execFileSync("npx", ["tsx", "scripts/migrate.ts"], { env, stdio: "inherit" });
  execFileSync("npx", ["tsx", "scripts/seed.ts"], { env, stdio: "inherit" });
}
