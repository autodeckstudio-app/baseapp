import React from 'react';
import { it, expect, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
vi.mock('./kit', () => ({ Kicker: 'Kicker', Pane: 'Pane', T: 'T', Chip: 'Chip', InfoLine: 'InfoLine' }));
vi.mock('./IconAction', () => ({ IconAction: 'IconAction' }));
vi.mock('./FloatingObject', () => ({ FloatingObject: 'FloatingObject' }));
vi.mock('./NavIcon', () => ({ NavIcon: 'NavIcon' }));
vi.mock('../lib/gift-share', () => ({ giftMessage: () => '', shareGift: async () => null }));
import { GiftCard } from './GiftCard';
it('expired code never claims to end today, while positive remaining days stay exact', async () => {
  let r: any; const now = Date.parse('2026-11-19T04:00:00Z');
  await act(async () => { r = create(<GiftCard code="GW23456789" expiresAt="2026-11-18T04:00:00Z" buyerName={null} now={now} />); });
  expect(JSON.stringify(r.toJSON())).toContain('Expired');
  expect(JSON.stringify(r.toJSON())).not.toContain('Ends today');
  await act(async () => r.update(<GiftCard code="GW23456789" expiresAt="2026-11-20T04:00:00Z" buyerName={null} now={now} />));
  expect(JSON.stringify(r.toJSON())).toContain('1 day left');
  await act(async () => r.unmount());
});
