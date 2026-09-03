/** The `customers/{id}` Firestore document shape. */
export interface CustomerRecord {
  customerId: string; // backend-generated Firestore document ID — never client-supplied
  name: string;
  phone: string;
  email: string;
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  createdByStaffId: string;
}
