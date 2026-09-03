import { deriveSessionState } from './sessionState';

describe('deriveSessionState', () => {
  it('is unauthenticated when there is no Firebase user', () => {
    expect(deriveSessionState(null)).toEqual({ status: 'unauthenticated' });
  });

  it('is authenticated for any signed-in Firebase user — customers never carry a role claim', () => {
    expect(deriveSessionState({ uid: 'u1' })).toEqual({ status: 'authenticated', uid: 'u1' });
  });
});
