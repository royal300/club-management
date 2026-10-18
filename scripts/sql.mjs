// Tiny SQL runner for local maintenance: node scripts/sql.mjs "SELECT 1"
import "dotenv/config";
import mysql from "mysql2/promise";
const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
const [rows] = await conn.query(process.argv[2]);
console.table(Array.isArray(rows) ? rows : [rows]);
await conn.end();
