import { deriveSessionState } from './sessionState';

describe('deriveSessionState', () => {
  it('is unauthenticated when there is no Firebase user', () => {
    expect(deriveSessionState(null, null)).toEqual({ status: 'unauthenticated' });
  });

  it('is authenticated with the verified role claim when a valid role is present', () => {
    expect(deriveSessionState({ uid: 'u1' }, { role: 'owner_admin' })).toEqual({
      status: 'authenticated',
      uid: 'u1',
      role: 'owner_admin',
    });
  });

  it.each(['owner_admin', 'studio_manager', 'staff'] as const)('accepts the valid role "%s"', (role) => {
    expect(deriveSessionState({ uid: 'u1' }, { role })).toEqual({ status: 'authenticated', uid: 'u1', role });
  });

  it('fails closed to unauthenticated when signed in but the token has no role claim at all', () => {
    expect(deriveSessionState({ uid: 'u1' }, {})).toEqual({ status: 'unauthenticated' });
  });

  it('fails closed to unauthenticated when signed in but claims is null', () => {
    expect(deriveSessionState({ uid: 'u1' }, null)).toEqual({ status: 'unauthenticated' });
  });

  it('fails closed to unauthenticated when the role claim is not a recognized value', () => {
    expect(deriveSessionState({ uid: 'u1' }, { role: 'technician' })).toEqual({ status: 'unauthenticated' });
  });

  it('never grants access based on jobTitle, even if one is present on the token', () => {
    // A jobTitle of "Owner" is deliberately present here to prove it has no
    // effect — only the verified `role` claim is ever read.
    const result = deriveSessionState({ uid: 'u1' }, { jobTitle: 'Owner' });
    expect(result).toEqual({ status: 'unauthenticated' });
  });

  it('never grants access based on jobTitle even when a valid role is also present — role alone decides', () => {
    const result = deriveSessionState({ uid: 'u1' }, { role: 'staff', jobTitle: 'Owner' });
    expect(result).toEqual({ status: 'authenticated', uid: 'u1', role: 'staff' });
  });
});
