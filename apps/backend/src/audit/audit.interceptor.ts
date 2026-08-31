import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { AUDIT_ACTION_KEY } from './audit-action.decorator';
import { AuditLogService } from './audit-log.service';

/**
 * Writes an audit entry after a successful @AuditAction() handler returns,
 * using the same actor identity FirebaseAuthGuard verified. Handlers with
 * no @AuditAction are left alone entirely.
 *
 * The write is AWAITED (via concatMap, not tap+void) so it is part of the
 * request lifecycle rather than fire-and-forget, and a failure is caught
 * and logged explicitly rather than becoming a silent unhandled rejection.
 *
 * Phase 1 boundary (approved): this does NOT make the mutation and the
 * audit write atomic — there is no real business mutation in Phase 1 to
 * make atomic with, and no transaction/rollback is introduced here. Per
 * the approved Phase 2 architectural rule, atomicity for a real mutation
 * must be implemented in that mutation's own Firestore transaction/batch,
 * not guaranteed by this generic interceptor.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string | undefined>(AUDIT_ACTION_KEY, context.getHandler());
    if (!action) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.authUser;
    const requestId = randomUUID();

    return next.handle().pipe(
      concatMap(async (result: unknown) => {
        const entityId =
          typeof result === 'object' && result !== null && 'id' in result
            ? String((result as { id: unknown }).id)
            : 'unknown';

        try {
          await this.auditLogService.record({
            actorId: user?.uid ?? 'unknown',
            actorRole: user?.role ?? 'unknown',
            action,
            entityType: action.split('.')[0] ?? 'unknown',
            entityId,
            requestId,
          });
        } catch (error) {
          // Explicit handling, per the approved Phase 1 boundary: logged,
          // not swallowed silently — but the response is still returned.
          // No rollback/retry is invented here; that guarantee belongs to
          // Phase 2's per-mutation transactions, not this interceptor.
          this.logger.error(
            `Failed to write audit log for action "${action}" (requestId=${requestId})`,
            error instanceof Error ? error.stack : String(error),
          );
        }

        return result;
      }),
    );
  }
}
