import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module';
import { BookingsModule } from '../bookings/bookings.module';
import type { EnvConfig } from '../config/configuration';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayWebhookController } from './razorpay-webhook.controller';
import { RazorpayWebhookService } from './razorpay-webhook.service';
import { RAZORPAY_CLIENT, createRazorpayClient } from './razorpay.provider';

@Module({
  imports: [AuditModule, BookingsModule, ConfigModule],
  controllers: [PaymentsController, RazorpayWebhookController],
  providers: [
    PaymentsService,
    RazorpayWebhookService,
    {
      provide: RAZORPAY_CLIENT,
      useFactory: (configService: ConfigService<EnvConfig, true>) =>
        createRazorpayClient({
          keyId: configService.get('RAZORPAY_KEY_ID', { infer: true }),
          keySecret: configService.get('RAZORPAY_KEY_SECRET', { infer: true }),
        }),
      inject: [ConfigService],
    },
  ],
})
export class PaymentsModule {}
