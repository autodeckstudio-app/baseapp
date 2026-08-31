import type { PermissionRole } from '../auth/role.type';

/** The `staff/{id}` Firestore document shape. */
export interface StaffRecord {
  staffId: string; // = Firebase Auth uid
  name: string;
  phone: string;
  email: string;
  jobTitle: string; // metadata only — never read for authorization
  permissionRole: PermissionRole;
  active: boolean;
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  createdByStaffId: string;
}
