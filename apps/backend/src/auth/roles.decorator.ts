import { SetMetadata } from '@nestjs/common';
import type { PermissionRole } from './role.type';

export const ROLES_KEY = 'requiredRoles';

/** Declares the minimum permission role(s) an endpoint accepts. */
export const Roles = (...roles: PermissionRole[]) => SetMetadata(ROLES_KEY, roles);
