import type { Role } from "@/db/schema";

export type Permission =
  | "members:write"
  | "transactions:write"
  | "events:write"
  | "audit:read"
  | "settings:write"
  | "users:manage"
  | "export";

const MATRIX: Record<Role, readonly Permission[]> = {
  ADMIN: [
    "members:write",
    "transactions:write",
    "events:write",
    "audit:read",
    "settings:write",
    "users:manage",
    "export",
  ],
  TREASURER: ["members:write", "transactions:write", "events:write", "audit:read", "export"],
  VIEWER: ["export"],
};

export function can(role: Role | undefined | null, permission: Permission) {
  return !!role && MATRIX[role].includes(permission);
}
