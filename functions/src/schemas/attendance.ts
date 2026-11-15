import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");
const monthString = z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM");

export const attendanceCheckSchema = z.object({
  notes: z.string().max(300).optional(),
}).strict();

export const getStudioAttendanceSchema = z.object({
  studioId: z.string().min(1),
  date: dateString.optional(),
}).strict();

export const getEmployeeAttendanceSchema = z.object({
  employeeId: z.string().min(1),
  month: monthString,
}).strict();

export const markAttendanceSchema = z.object({
  employeeId: z.string().min(1),
  date: dateString,
  status: z.enum(["PRESENT", "HALF_DAY", "ABSENT", "ON_LEAVE"]),
  notes: z.string().max(300).optional(),
}).strict();

export type AttendanceCheckInput = z.infer<typeof attendanceCheckSchema>;
export type GetStudioAttendanceInput = z.infer<typeof getStudioAttendanceSchema>;
export type GetEmployeeAttendanceInput = z.infer<typeof getEmployeeAttendanceSchema>;
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
