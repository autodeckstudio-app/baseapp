import type { PermissionRole } from '@autodeck/domain';

/**
 * Fixture data mirroring the REAL `StaffRecord` shape
 * (`apps/backend/src/staff/staff.types.ts`): `jobTitle` is display
 * metadata only; `permissionRole` (the real `PermissionRole` type) is the
 * only thing that ever authorizes anything — kept visually distinct in
 * the Staff screen per the approved rule.
 */
export interface MockStaff {
  staffId: string;
  name: string;
  email: string;
  jobTitle: string;
  permissionRole: PermissionRole;
  active: boolean;
}

export const MOCK_STAFF: MockStaff[] = [
  { staffId: 'staff-1', name: 'Vikram Rao', email: 'vikram.rao@autodeck.studio', jobTitle: 'Detailer', permissionRole: 'staff', active: true },
  { staffId: 'staff-2', name: 'Neha Kapoor', email: 'neha.kapoor@autodeck.studio', jobTitle: 'Service Advisor', permissionRole: 'staff', active: true },
  { staffId: 'staff-3', name: 'Arjun Desai', email: 'arjun.desai@autodeck.studio', jobTitle: 'Studio Manager', permissionRole: 'studio_manager', active: true },
  { staffId: 'staff-4', name: 'Founder Account', email: 'owner@autodeck.studio', jobTitle: 'Owner', permissionRole: 'owner_admin', active: true },
];
