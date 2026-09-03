import { deriveSessionState } from './sessionState';

describe('deriveSessionState', () => {
  it('is unauthenticated when there is no Firebase user', () => {
    expect(deriveSessionState(null, null)).toEqual({ status: 'unauthenticated' });
  });

  it.each(['owner_admin', 'studio_manager', 'staff'] as const)(
    'is authenticated with the verified role claim "%s"',
    (role) => {
      expect(deriveSessionState({ uid: 'u1' }, { role })).toEqual({ status: 'authenticated', uid: 'u1', role });
    },
  );

  it('fails closed to unauthenticated when signed in but the token has no role claim', () => {
    expect(deriveSessionState({ uid: 'u1' }, {})).toEqual({ status: 'unauthenticated' });
  });

  it('fails closed to unauthenticated when the role claim is not a recognized value', () => {
    expect(deriveSessionState({ uid: 'u1' }, { role: 'technician' })).toEqual({ status: 'unauthenticated' });
  });

  it('never grants access based on jobTitle', () => {
    expect(deriveSessionState({ uid: 'u1' }, { jobTitle: 'Owner' })).toEqual({ status: 'unauthenticated' });
  });

  it('ignores jobTitle even when a valid role is also present — role alone decides', () => {
    expect(deriveSessionState({ uid: 'u1' }, { role: 'staff', jobTitle: 'Owner' })).toEqual({
      status: 'authenticated',
      uid: 'u1',
      role: 'staff',
    });
  });
});
