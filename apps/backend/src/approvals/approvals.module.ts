import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BookingsModule } from '../bookings/bookings.module';
import { VisitsModule } from '../visits/visits.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({
  imports: [AuditModule, BookingsModule, VisitsModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}
