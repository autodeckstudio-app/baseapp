import { hasSufficientRole, canManageTargetRole } from './role.type';

describe('hasSufficientRole', () => {
  it('allows a role to act at its own minimum', () => {
    expect(hasSufficientRole('staff', 'staff')).toBe(true);
  });

  it('allows a higher role to act at a lower minimum', () => {
    expect(hasSufficientRole('owner_admin', 'staff')).toBe(true);
    expect(hasSufficientRole('studio_manager', 'staff')).toBe(true);
  });

  it('rejects a lower role acting at a higher minimum', () => {
    expect(hasSufficientRole('staff', 'studio_manager')).toBe(false);
    expect(hasSufficientRole('studio_manager', 'owner_admin')).toBe(false);
  });
});

describe('canManageTargetRole', () => {
  it('allows Studio Manager to manage a Staff-tier target', () => {
    expect(canManageTargetRole('studio_manager', 'staff')).toBe(true);
  });

  it('allows Owner/Admin to manage a Staff-tier target', () => {
    expect(canManageTargetRole('owner_admin', 'staff')).toBe(true);
  });

  it('denies Staff from managing any target (never reaches this in practice, but must be denied)', () => {
    expect(canManageTargetRole('staff', 'staff')).toBe(false);
  });

  it('denies Studio Manager from managing a Studio-Manager-tier target', () => {
    expect(canManageTargetRole('studio_manager', 'studio_manager')).toBe(false);
  });

  it('denies Studio Manager from managing an Owner/Admin-tier target', () => {
    expect(canManageTargetRole('studio_manager', 'owner_admin')).toBe(false);
  });

  it('allows Owner/Admin to manage a Studio-Manager-tier target', () => {
    expect(canManageTargetRole('owner_admin', 'studio_manager')).toBe(true);
  });

  it('allows Owner/Admin to manage an Owner/Admin-tier target', () => {
    expect(canManageTargetRole('owner_admin', 'owner_admin')).toBe(true);
  });
});
