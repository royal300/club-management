/* eslint-disable @typescript-eslint/no-require-imports */
// PM2 process file, started by deploy/deploy.sh with APP_ROOT=<app>/current so a restart
// always runs the release `current` points at. Without APP_ROOT it runs from this checkout.
// The port is read from APP_PORT in .env (default 3105). Next.js loads .env itself.
const fs = require("node:fs");
const path = require("node:path");

const root = process.env.APP_ROOT || path.resolve(__dirname, "..");
const logDir = process.env.APP_LOG_DIR || path.join(root, "logs");
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
      out_file: path.join(logDir, "out.log"),
      error_file: path.join(logDir, "error.log"),
      time: true,
    },
  ],
};
