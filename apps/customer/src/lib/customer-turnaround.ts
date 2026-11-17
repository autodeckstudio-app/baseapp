import type { Service } from '@autodeck/core';
/** Customer collection estimate, deliberately separate from internal bay minutes. */
export function customerTurnaround(service: Pick<Service, 'category' | 'priceOnRequest' | 'estimatedDurationMinutes'>) {
  if (service.priceOnRequest) return { value: 'Visit', label: 'studio first', accessible: 'Studio inspection' };
  if (service.category === 'ceramic') return { value: '1-2 days', label: 'estimated turnaround', accessible: 'Estimated turnaround 1-2 days' };
  if (service.category === 'ppf') return { value: '2-3 days', label: 'estimated turnaround', accessible: 'Estimated turnaround 2-3 days' };
  return { value: `${service.estimatedDurationMinutes / 60}h`, label: 'working time', accessible: `${service.estimatedDurationMinutes / 60}h working time` };
}
