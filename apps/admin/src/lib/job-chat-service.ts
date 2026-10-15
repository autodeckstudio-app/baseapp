"use client";

import { collection, onSnapshot, orderBy, query, where, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { COLLECTIONS } from "@autodeck/database";
import type { JobMessage } from "@autodeck/core";
import { db, functions } from "./firebase";

export function listenToJobMessages(jobId: string, tenantId: string, customerId: string, onData: (m: JobMessage[]) => void, onError: (e: Error) => void): Unsubscribe {
  const q = query(collection(db, COLLECTIONS.jobMessages()), where("jobId", "==", jobId), where("tenantId", "==", tenantId), where("customerId", "==", customerId), orderBy("createdAt", "asc"));
  return onSnapshot(q, (s) => onData(s.docs.map((d) => d.data() as JobMessage)), onError);
}

export async function sendJobMessage(jobId: string, text: string): Promise<void> {
  await httpsCallable(functions, "sendJobMessage")({ jobId, text });
}
