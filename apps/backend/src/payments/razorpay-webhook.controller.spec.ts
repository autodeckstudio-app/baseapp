import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { RazorpayWebhookController } from './razorpay-webhook.controller';
import type { RazorpayWebhookService } from './razorpay-webhook.service';

describe('RazorpayWebhookController', () => {
  it('marks the webhook route as public — no Firebase token required, security comes from signature verification alone', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, RazorpayWebhookController.prototype.handleWebhook)).toBe(true);
  });

  it('has no @Roles() requirement — RolesGuard would have nothing to check against on an unauthenticated request', () => {
    // Absence check: FirebaseAuthGuard already short-circuits @Public()
    // routes before RolesGuard ever runs, so no @Roles() metadata should
    // exist here at all.
    const ROLES_KEY = 'requiredRoles';
    expect(Reflect.getMetadata(ROLES_KEY, RazorpayWebhookController.prototype.handleWebhook)).toBeUndefined();
  });

  it('delegates to RazorpayWebhookService with the raw body and signature header, verbatim', async () => {
    const webhookService = {
      processWebhook: jest.fn().mockResolvedValue({ status: 'processed' }),
    } as unknown as RazorpayWebhookService;
    const controller = new RazorpayWebhookController(webhookService);
    const rawBody = Buffer.from('{"event":"payment.captured"}');
    const req = { rawBody } as unknown as Parameters<RazorpayWebhookController['handleWebhook']>[0];

    await controller.handleWebhook(req, 'sig123');

    expect(webhookService.processWebhook).toHaveBeenCalledWith(rawBody, 'sig123');
  });

  it('passes through an undefined signature when the header is absent', async () => {
    const webhookService = {
      processWebhook: jest.fn().mockResolvedValue({ status: 'processed' }),
    } as unknown as RazorpayWebhookService;
    const controller = new RazorpayWebhookController(webhookService);
    const req = { rawBody: undefined } as unknown as Parameters<RazorpayWebhookController['handleWebhook']>[0];

    await controller.handleWebhook(req, undefined);

    expect(webhookService.processWebhook).toHaveBeenCalledWith(undefined, undefined);
  });
});
