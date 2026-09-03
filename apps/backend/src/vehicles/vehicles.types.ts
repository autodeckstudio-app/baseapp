/** The `vehicles/{id}` Firestore document shape. */
export interface VehicleRecord {
  vehicleId: string; // backend-generated Firestore document ID
  make: string;
  model: string;
  plate: string;
  ownerCustomerId: string; // server-derived from the URL's customerId — never client-supplied
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  createdByStaffId: string;
}
