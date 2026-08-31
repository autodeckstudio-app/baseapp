import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';
import type { PermissionRole } from './role.type';

/**
 * A strict hierarchy, matching the approved capability matrix exactly:
 * everything Staff can do, Studio Manager can also do; everything Studio
 * Manager can do, Owner/Admin can also do. There is no case in the approved
 * design where a higher role is denied something a lower role is granted.
 */
const ROLE_RANK: Record<PermissionRole, number> = {
  staff: 0,
  studio_manager: 1,
  owner_admin: 2,
};

/**
 * Enforces the minimum role declared via @Roles(). Reads ONLY the verified
 * `role` attached by FirebaseAuthGuard — never jobTitle, never anything
 * client-supplied. Fails closed if no authenticated user is present at all
 * (which would indicate FirebaseAuthGuard didn't run first).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<PermissionRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      // No @Roles() declared: any authenticated caller is permitted by role.
      // Ownership-based restrictions (e.g. "your own booking only") are a
      // separate concern, handled in the relevant module's own logic.
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.authUser;

    if (!user) {
      throw new ForbiddenException('No authenticated user on request');
    }

    const minimumRequired = Math.min(...requiredRoles.map((r) => ROLE_RANK[r]));
    const hasSufficientRole = ROLE_RANK[user.role] >= minimumRequired;

    if (!hasSufficientRole) {
      throw new ForbiddenException(`Role "${user.role}" is not permitted to perform this action`);
    }
    return true;
  }
}
