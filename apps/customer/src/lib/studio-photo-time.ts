/** PROPOSED preview boundaries, pending owner review. Studio time, not device time. */
export const STUDIO_PHOTO_SCHEDULE = { dayStartsAtHour: 6, nightStartsAtHour: 18, timeZone: 'Asia/Kolkata' } as const;
export type StudioPhotoPeriod = 'day' | 'night';
export function studioPhotoPeriod(now = new Date()): StudioPhotoPeriod {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: STUDIO_PHOTO_SCHEDULE.timeZone, hour: '2-digit', hourCycle: 'h23' }).format(now));
  return hour >= STUDIO_PHOTO_SCHEDULE.dayStartsAtHour && hour < STUDIO_PHOTO_SCHEDULE.nightStartsAtHour ? 'day' : 'night';
}
