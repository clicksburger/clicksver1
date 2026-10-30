import type { RolStaff } from "@/constants/roles";

export interface StaffSession {
  userId: string;
  email: string | null;
  tenantId: string;
  rol: RolStaff;
}
