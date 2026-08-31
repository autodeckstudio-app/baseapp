import { Logger } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import type { AuditLogService } from './audit-log.service';

describe('AuditInterceptor', () => {
  it('awaits the audit write and records exactly one entry, from the verified actor, when @AuditAction is declared', async () => {
    const record = jest.fn().mockResolvedValue('audit-1');
    const auditLogService = { record } as unknown as AuditLogService;
    const reflector = { get: jest.fn().mockReturnValue('booking.cancel') } as unknown as Reflector;
    const interceptor = new AuditInterceptor(reflector, auditLogService);

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ authUser: { uid: 'staff-1', role: 'staff' } }),
      }),
      getHandler: () => ({}),
    } as unknown as ExecutionContext;

    const next: CallHandler = { handle: () => of({ id: 'booking-123' }) };

    const result = await new Promise((resolve) => {
      interceptor.intercept(context, next).subscribe(resolve);
    });

    expect(result).toEqual({ id: 'booking-123' });
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'staff-1',
        actorRole: 'staff',
        action: 'booking.cancel',
        entityType: 'booking',
        entityId: 'booking-123',
      }),
    );
  });

  it('does not record anything when the handler has no @AuditAction', async () => {
    const record = jest.fn();
    const auditLogService = { record } as unknown as AuditLogService;
    const reflector = { get: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const interceptor = new AuditInterceptor(reflector, auditLogService);

    const context = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
      getHandler: () => ({}),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of({ status: 'ok' }) };

    const result = await new Promise((resolve) => {
      interceptor.intercept(context, next).subscribe(resolve);
    });

    expect(result).toEqual({ status: 'ok' });
    expect(record).not.toHaveBeenCalled();
  });

  it('does NOT fire-and-forget: a rejected audit write is awaited, caught, and logged — never an unhandled rejection', async () => {
    const auditError = new Error('emulator write failed');
    const record = jest.fn().mockRejectedValue(auditError);
    const auditLogService = { record } as unknown as AuditLogService;
    const reflector = { get: jest.fn().mockReturnValue('booking.cancel') } as unknown as Reflector;
    const interceptor = new AuditInterceptor(reflector, auditLogService);

    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ authUser: { uid: 'staff-1', role: 'staff' } }),
      }),
      getHandler: () => ({}),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of({ id: 'booking-123' }) };

    // Fails the test if the audit-write rejection escapes as an unhandled
    // promise rejection / observable error instead of being caught.
    const result = await new Promise((resolve, reject) => {
      interceptor.intercept(context, next).subscribe({ next: resolve, error: reject });
    });

    expect(result).toEqual({ id: 'booking-123' }); // response still succeeds — no fake rollback invented
    expect(record).toHaveBeenCalledTimes(1); // the write was actually attempted and awaited
    expect(loggerErrorSpy).toHaveBeenCalledTimes(1); // failure is explicitly handled, not swallowed silently
    expect(loggerErrorSpy.mock.calls[0]?.[0]).toContain('booking.cancel');

    loggerErrorSpy.mockRestore();
  });
});
