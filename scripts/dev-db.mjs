// Local-only throwaway MySQL for development and Playwright runs.
// Production uses the real MySQL server configured via DATABASE_URL.
import { createDB } from "mysql-memory-server";

const port = Number(process.env.DEV_DB_PORT ?? 3307);
const db = await createDB({
  version: "8.4.x",
  port,
  dbName: "club_management",
  logLevel: "WARN",
  initSQLString: `
    CREATE USER IF NOT EXISTS 'club_app'@'%' IDENTIFIED BY 'club_dev_password';
    GRANT ALL PRIVILEGES ON club_management.* TO 'club_app'@'%';
    FLUSH PRIVILEGES;
  `,
});
console.log(`[dev-db] MySQL ${db.mysql.version} ready on 127.0.0.1:${db.port} (db=${db.dbName})`);

const shutdown = async () => {
  await db.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
setInterval(() => {}, 1 << 30);
