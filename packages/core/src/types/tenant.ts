export type TenantPlan = "starter" | "growth" | "enterprise";

export interface Tenant {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  plan: TenantPlan;
  active: boolean;
  createdAt: string; // ISO timestamp
}
