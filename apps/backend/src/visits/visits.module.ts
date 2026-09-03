import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BookingsModule } from '../bookings/bookings.module';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';

@Module({
  imports: [AuditModule, BookingsModule],
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
