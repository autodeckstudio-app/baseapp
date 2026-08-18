import { collection, query, where, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { SUBCOLLECTIONS } from "@autodeck/database";
import type { Protection } from "@autodeck/core";

export function listenToVehicleProtections(
  vehicleId: string,
  tenantId: string,
  customerId: string,
  onData: (protections: Protection[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, SUBCOLLECTIONS.vehicleProtections(vehicleId)),
    where("tenantId", "==", tenantId),
    where("customerId", "==", customerId),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as Protection)),
    onError,
  );
}
