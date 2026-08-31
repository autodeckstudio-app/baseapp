import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import * as admin from 'firebase-admin';
import { FIREBASE_ADMIN_APP } from './firebase-admin.provider';
import { IS_PUBLIC_KEY } from './public.decorator';
import { isPermissionRole, type PermissionRole } from './role.type';

export interface AuthenticatedUser {
  uid: string;
  role: PermissionRole;
}

declare module 'express' {
  interface Request {
    authUser?: AuthenticatedUser;
  }
}

/**
 * Verifies the Firebase ID token on every non-public request and attaches
 * the caller's uid + verified `role` custom claim to the request.
 *
 * This is the ONLY source of role information used anywhere downstream —
 * never a request body, header, or query parameter, and never `jobTitle`
 * (which this guard never reads or knows about at all).
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    @Inject(FIREBASE_ADMIN_APP) private readonly app: admin.app.App,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = authHeader.slice('Bearer '.length);

    let decoded: admin.auth.DecodedIdToken;
    try {
      // `true` enables revocation checking: a token from a deactivated
      // staff account (or any revoked session) fails verification here,
      // not just an invalid/expired one. Fails closed: any failure of this
      // call — invalid signature, expiry, revocation, or a failure of the
      // revocation lookup itself — is treated identically below. The
      // specific reason is deliberately never distinguished in the
      // response, so a caller cannot learn anything about *why* a token
      // was rejected.
      decoded = await this.app.auth().verifyIdToken(token, true);
    } catch {
      throw new UnauthorizedException('Authentication failed');
    }

    const claimedRole: unknown = decoded.role;
    if (!isPermissionRole(claimedRole)) {
      // Fails closed: a token with no valid role claim is rejected, not
      // treated as any default role.
      throw new ForbiddenException('Token has no valid role claim');
    }

    request.authUser = { uid: decoded.uid, role: claimedRole };
    return true;
  }
}
