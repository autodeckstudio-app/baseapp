export type AttendanceStatus = "PRESENT" | "HALF_DAY" | "ABSENT" | "ON_LEAVE";

export interface AttendanceBreak {
  startedAt: string; // ISO UTC
  endedAt: string | null; // ISO UTC, null while on break
}

/**
 * One attendance record per employee per studio day. Document id is
 * deterministic (`${tenantId}__${employeeId}__${date}`) so a duplicate
 * check-in can never create a second record for the same day.
 */
export interface AttendanceRecord {
  id: string;
  tenantId: string;
  studioId: string;
  employeeId: string;
  // Firebase uid of the employee's Google account, denormalized from the
  // roster record so security rules can let an employee read their own
  // record without a cross-document join.
  employeeAuthUid: string;
  date: string; // "YYYY-MM-DD" in studio TZ
  status: AttendanceStatus;
  checkInAt: string | null; // ISO UTC
  checkOutAt: string | null; // ISO UTC
  breaks: AttendanceBreak[]; // append-only embedded array
  // Server-computed at checkout: (checkOutAt - checkInAt) minus break time.
  workedMinutes: number;
  notes: string | null;
  // uid who recorded the latest mutation (self check-in, or admin marking).
  markedBy: string;
  createdAt: string;
  updatedAt: string;
}
