/* eslint-disable @typescript-eslint/no-require-imports */
// PM2 process file. Usage on the server (from the app directory):
//   pm2 start deploy/ecosystem.config.cjs && pm2 save
// The port is read from APP_PORT in .env (default 3105). Next.js loads .env itself.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
let port = "3105";
try {
  const env = fs.readFileSync(path.join(root, ".env"), "utf8");
  const m = env.match(/^APP_PORT\s*=\s*"?(\d+)"?/m);
  if (m) port = m[1];
} catch {}

module.exports = {
  apps: [
    {
      name: "club-management",
      cwd: root,
      script: "node_modules/next/dist/bin/next",
      args: `start -H 127.0.0.1 -p ${port}`,
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "600M",
      env: { NODE_ENV: "production", TZ: "Asia/Kolkata" },
      out_file: path.join(root, "logs/out.log"),
      error_file: path.join(root, "logs/error.log"),
      time: true,
    },
  ],
};
