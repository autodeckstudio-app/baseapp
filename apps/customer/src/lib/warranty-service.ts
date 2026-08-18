import { collection, query, where, orderBy, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Warranty } from "@autodeck/core";

export function listenToVehicleWarranties(
  vehicleId: string,
  tenantId: string,
  customerId: string,
  onData: (warranties: Warranty[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.warranties()),
    where("vehicleId", "==", vehicleId),
    where("tenantId", "==", tenantId),
    where("customerId", "==", customerId),
    orderBy("sealedAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as Warranty)),
    onError,
  );
}
