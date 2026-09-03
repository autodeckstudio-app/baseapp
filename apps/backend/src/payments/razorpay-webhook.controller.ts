import { Controller, Headers, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator';
import { RazorpayWebhookService } from './razorpay-webhook.service';

/**
 * The ONE deliberate exception to "every non-public route requires a
 * verified Firebase ID token": Razorpay's server calls this endpoint
 * directly and can never present one. `@Public()` bypasses
 * FirebaseAuthGuard entirely — security here comes exclusively from
 * `RazorpayWebhookService.processWebhook`'s HMAC signature verification
 * against the raw request body, which is why `main.ts` enables
 * `rawBody: true` (see its comment). This route reads `req.rawBody`
 * directly rather than using `@Body()`, so it never touches the
 * pre-existing global ZodValidationPipe at all.
 */
@Controller('razorpay')
export class RazorpayWebhookController {
  constructor(private readonly webhookService: RazorpayWebhookService) {}

  @Public()
  @Post('webhook')
  handleWebhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature?: string) {
    return this.webhookService.processWebhook(req.rawBody, signature);
  }
}
