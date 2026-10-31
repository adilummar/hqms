export const STAFF_ROLES = [
  "super_admin",
  "admin",
  "tutor",
  "school_admin",
  "madrasa_admin",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
