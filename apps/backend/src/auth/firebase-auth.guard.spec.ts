import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type * as admin from 'firebase-admin';
import { FirebaseAuthGuard } from './firebase-auth.guard';

function buildContext(headers: Record<string, string> = {}): ExecutionContext {
  const request: { headers: Record<string, string>; authUser?: unknown } = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function buildApp(verifyIdToken: jest.Mock): admin.app.App {
  return { auth: () => ({ verifyIdToken }) } as unknown as admin.app.App;
}

function buildReflector(isPublic: boolean | undefined): Reflector {
  return { getAllAndOverride: jest.fn().mockReturnValue(isPublic) } as unknown as Reflector;
}

describe('FirebaseAuthGuard', () => {
  it('allows a public endpoint through without checking any token', async () => {
    const verifyIdToken = jest.fn();
    const guard = new FirebaseAuthGuard(buildApp(verifyIdToken), buildReflector(true));
    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects a request with no bearer token', async () => {
    const guard = new FirebaseAuthGuard(buildApp(jest.fn()), buildReflector(false));
    await expect(guard.canActivate(buildContext())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('calls verifyIdToken with checkRevoked=true', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({ uid: 'u1', role: 'staff' });
    const guard = new FirebaseAuthGuard(buildApp(verifyIdToken), buildReflector(false));
    await guard.canActivate(buildContext({ authorization: 'Bearer good-token' }));
    expect(verifyIdToken).toHaveBeenCalledWith('good-token', true);
  });

  it('attaches uid and role for a valid, non-revoked token', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({ uid: 'u1', role: 'studio_manager' });
    const guard = new FirebaseAuthGuard(buildApp(verifyIdToken), buildReflector(false));
    const context = buildContext({ authorization: 'Bearer good-token' });
    await guard.canActivate(context);
    expect(context.switchToHttp().getRequest<{ authUser?: unknown }>().authUser).toEqual({
      uid: 'u1',
      role: 'studio_manager',
    });
  });

  it('rejects an invalid-signature token', async () => {
    const verifyIdToken = jest.fn().mockRejectedValue({ code: 'auth/argument-error' });
    const guard = new FirebaseAuthGuard(buildApp(verifyIdToken), buildReflector(false));
    await expect(
      guard.canActivate(buildContext({ authorization: 'Bearer bad-token' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a revoked token — fails closed, same as any other verification failure', async () => {
    const verifyIdToken = jest.fn().mockRejectedValue({ code: 'auth/id-token-revoked' });
    const guard = new FirebaseAuthGuard(buildApp(verifyIdToken), buildReflector(false));
    await expect(
      guard.canActivate(buildContext({ authorization: 'Bearer revoked-token' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects on an ambiguous/unexpected verification error (e.g. a revocation-lookup failure) — never lets it through', async () => {
    const verifyIdToken = jest.fn().mockRejectedValue(new Error('network hiccup during revocation lookup'));
    const guard = new FirebaseAuthGuard(buildApp(verifyIdToken), buildReflector(false));
    await expect(
      guard.canActivate(buildContext({ authorization: 'Bearer whatever' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('gives the exact same error message across invalid, expired, revoked, and lookup-failure cases — never reveals which', async () => {
    const rejections: unknown[] = [
      { code: 'auth/argument-error' },
      { code: 'auth/id-token-expired' },
      { code: 'auth/id-token-revoked' },
      new Error('unexpected revocation-lookup failure'),
    ];

    const messages: string[] = [];
    for (const rejection of rejections) {
      const verifyIdToken = jest.fn().mockRejectedValue(rejection);
      const guard = new FirebaseAuthGuard(buildApp(verifyIdToken), buildReflector(false));
      try {
        await guard.canActivate(buildContext({ authorization: 'Bearer x' }));
        throw new Error('expected canActivate to reject');
      } catch (err) {
        messages.push((err as UnauthorizedException).message);
      }
    }

    expect(messages).toHaveLength(rejections.length);
    expect(new Set(messages).size).toBe(1);
  });

  it('rejects (Forbidden, not Unauthorized) a token that verifies but carries no valid role claim', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({ uid: 'u1' }); // no role claim at all
    const guard = new FirebaseAuthGuard(buildApp(verifyIdToken), buildReflector(false));
    await expect(
      guard.canActivate(buildContext({ authorization: 'Bearer good-token-no-role' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
