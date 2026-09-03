import { canAccessAdminDashboard } from './roleAccess';

describe('canAccessAdminDashboard', () => {
  it('allows owner_admin', () => {
    expect(canAccessAdminDashboard('owner_admin')).toBe(true);
  });

  it('allows studio_manager', () => {
    expect(canAccessAdminDashboard('studio_manager')).toBe(true);
  });

  it('denies staff — admin-web is never accessible to Staff-role accounts', () => {
    expect(canAccessAdminDashboard('staff')).toBe(false);
  });
});
