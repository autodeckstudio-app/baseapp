import { z } from "zod";

export const markNotificationReadSchema = z.object({
  notificationId: z.string().min(1),
});
