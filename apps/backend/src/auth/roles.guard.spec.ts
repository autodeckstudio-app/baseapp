import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { PermissionRole } from './role.type';

function buildContext(authUser?: { uid: string; role: PermissionRole } & Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ authUser }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function guardWithRequiredRoles(required: PermissionRole[] | undefined): RolesGuard {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows any authenticated caller when no @Roles() is declared', () => {
    const guard = guardWithRequiredRoles(undefined);
    expect(guard.canActivate(buildContext({ uid: 'u1', role: 'staff' }))).toBe(true);
  });

  it('allows Staff to call a Staff-minimum endpoint', () => {
    const guard = guardWithRequiredRoles(['staff']);
    expect(guard.canActivate(buildContext({ uid: 'u1', role: 'staff' }))).toBe(true);
  });

  it('rejects Staff from a Studio-Manager-minimum endpoint', () => {
    const guard = guardWithRequiredRoles(['studio_manager']);
    expect(() => guard.canActivate(buildContext({ uid: 'u1', role: 'staff' }))).toThrow(ForbiddenException);
  });

  it('allows Owner/Admin on a Staff-minimum endpoint (hierarchy)', () => {
    const guard = guardWithRequiredRoles(['staff']);
    expect(guard.canActivate(buildContext({ uid: 'u1', role: 'owner_admin' }))).toBe(true);
  });

  it('rejects Studio Manager from an Owner/Admin-only endpoint', () => {
    const guard = guardWithRequiredRoles(['owner_admin']);
    expect(() => guard.canActivate(buildContext({ uid: 'u1', role: 'studio_manager' }))).toThrow(
      ForbiddenException,
    );
  });

  it('fails closed when no authenticated user is present at all', () => {
    const guard = guardWithRequiredRoles(['staff']);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });

  it('never grants access based on jobTitle, even if one is smuggled onto the request', () => {
    const guard = guardWithRequiredRoles(['owner_admin']);
    // A jobTitle of "Owner" is deliberately present here to prove it has
    // zero effect — the guard only ever reads `role`, which is 'staff'.
    const context = buildContext({ uid: 'u1', role: 'staff', jobTitle: 'Owner' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
