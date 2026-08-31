import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'auditAction';

/** Declares that a successful call to this handler produces an audit entry. */
export const AuditAction = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
