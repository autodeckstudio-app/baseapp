import React from 'react';
import { it, expect, vi } from 'vitest';
import { create, act } from 'react-test-renderer';
// The Garage preview pop-up caps its history preview at the TWO most recent
// visits; everything older stays behind Open full details (the car room).
// This mounts the real GarageCarSheet with three delivered visits handed in
// out of order and asserts exactly the newest two render, capped, not deleted.
vi.mock('react-native', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-native');
  return { ...actual, Modal: ({ children, visible }: { children?: unknown; visible?: boolean }) => (visible === false ? null : children) };
});
vi.mock('../../../ui/CarThumb', () => ({ CarThumb: () => null }));
vi.mock('expo/fetch', () => ({ fetch: vi.fn() }));
vi.mock('../../../lib/paper-service', () => ({ daysUntil: (iso: string) => Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000) }));
import { GarageCarSheet } from '../../../ui/GarageCarSheet';

const car = { id: 'a', tenantId: 't', ownerId: 'cust-1', make: 'BMW', model: 'M340i', registrationNumber: 'MH 40 AB 1234', category: 'sedan', year: 2023, color: 'Black', odometer: 18450, photoUrl: null, deletedAt: null, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-11-06T00:00:00.000Z' };
const job = (id: string, serviceId: string, sealedAt: string) => ({ id, tenantId: 't', customerId: 'cust-1', vehicleId: 'a', bookingId: id, serviceId, status: 'DELIVERED', createdAt: sealedAt, sealedAt, updatedAt: sealedAt });

it('with three past visits the pop-up shows only the newest two; the oldest stays behind Open full details', async () => {
  const onOpenRoom = vi.fn();
  const jobs = [
    job('j-mid', 's-mid', '2026-11-01T10:00:00.000Z'),
    job('j-old', 's-old', '2026-10-20T10:00:00.000Z'),
    job('j-new', 's-new', '2026-11-07T10:00:00.000Z'),
  ]; // deliberately unsorted: the sheet must pick the newest two by visit date, not list position
  let r!: ReturnType<typeof create>;
  await act(async () => {
    r = create(<GarageCarSheet car={car as never} onClose={() => {}} onOpenRoom={onOpenRoom} jobs={jobs as never} svcNames={{ 's-new': 'Newest Coating', 's-mid': 'Second Wash', 's-old': 'Oldest Detail' }} papers={[]} />);
  });
  const text = JSON.stringify(r.toJSON());
  expect(text).toContain('Newest Coating');
  expect(text).toContain('Second Wash');
  expect(text).not.toContain('Oldest Detail');
  const full = r.root.findAll((n) => n.props && n.props.label === 'Open full details' && typeof n.props.onPress === 'function')[0]!;
  expect(full).toBeTruthy();
  await act(async () => { full.props.onPress(); });
  expect(onOpenRoom).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  await act(async () => { r.unmount(); });
});
