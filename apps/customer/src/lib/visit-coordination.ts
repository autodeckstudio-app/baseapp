import { httpsCallable } from "firebase/functions";
import { randomUUID } from "expo-crypto";
import { functions } from "./firebase";
import type { CoordinationRequestRead } from "@autodeck/core";
export const coordinationOperationId = () => randomUUID();
export type CoordinationCursor = { id: string; createdAt: string };
export async function requestVisitCoordination(input: {
  operationId: string;
  studioId: string;
  vehicleId: string;
  serviceIds: string[];
  notes?: string;
}) {
  return (
    await httpsCallable<unknown, CoordinationRequestRead>(
      functions,
      "requestVisitCoordination",
    )(input)
  ).data;
}
export async function getVisitCoordinationRequests(
  cursor?: CoordinationCursor,
) {
  return (
    await httpsCallable<
      unknown,
      {
        requests: CoordinationRequestRead[];
        nextCursor: CoordinationCursor | null;
      }
    >(
      functions,
      "getVisitCoordinationRequests",
    )({ ...(cursor ? { cursor } : {}) })
  ).data;
}
export async function withdrawVisitCoordinationRequest(
  row: CoordinationRequestRead,
  operationId: string,
) {
  return (
    await httpsCallable<unknown, CoordinationRequestRead>(
      functions,
      "updateVisitCoordinationRequest",
    )({
      id: row.id,
      expectedVersion: row.version,
      operationId,
      action: "withdraw",
    })
  ).data;
}
