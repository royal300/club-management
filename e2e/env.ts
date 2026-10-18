export const E2E = {
  dbUrl: process.env.E2E_DATABASE_URL ?? "mysql://club_app:club_dev_password@127.0.0.1:3307/club_test",
  adminUrl: process.env.E2E_DB_ADMIN_URL ?? "mysql://root:@127.0.0.1:3307/",
  admin: { email: process.env.E2E_ADMIN_EMAIL ?? "admin@club.local", password: process.env.E2E_ADMIN_PASSWORD ?? "ClubAdmin@2026" },
  treasurer: { email: "treasurer@club.local", password: "ClubTreasurer@2026" },
  viewer: { email: "viewer@club.local", password: "ClubViewer@2026" },
  live: !!process.env.E2E_BASE_URL,
};
