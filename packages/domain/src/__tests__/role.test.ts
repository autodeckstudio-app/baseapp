import { hasSufficientRole, isPermissionRole, ROLE_RANK } from '../role';

describe('isPermissionRole', () => {
  it('accepts each valid role', () => {
    expect(isPermissionRole('staff')).toBe(true);
    expect(isPermissionRole('studio_manager')).toBe(true);
    expect(isPermissionRole('owner_admin')).toBe(true);
  });

  it('rejects an arbitrary string', () => {
    expect(isPermissionRole('technician')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isPermissionRole(undefined)).toBe(false);
    expect(isPermissionRole(null)).toBe(false);
    expect(isPermissionRole(42)).toBe(false);
  });
});

describe('hasSufficientRole', () => {
  it('allows a role to act at its own tier', () => {
    expect(hasSufficientRole('staff', 'staff')).toBe(true);
  });

  it('allows a higher-tier role to act at a lower minimum', () => {
    expect(hasSufficientRole('owner_admin', 'staff')).toBe(true);
    expect(hasSufficientRole('studio_manager', 'staff')).toBe(true);
  });

  it('rejects a lower-tier role acting at a higher minimum', () => {
    expect(hasSufficientRole('staff', 'studio_manager')).toBe(false);
    expect(hasSufficientRole('studio_manager', 'owner_admin')).toBe(false);
  });
});

describe('ROLE_RANK', () => {
  it('is strictly increasing from staff to owner_admin', () => {
    expect(ROLE_RANK.staff).toBeLessThan(ROLE_RANK.studio_manager);
    expect(ROLE_RANK.studio_manager).toBeLessThan(ROLE_RANK.owner_admin);
  });
});
