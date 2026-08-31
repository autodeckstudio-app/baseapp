import { Module } from '@nestjs/common';
import { ConfigAppModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { StaffModule } from './staff/staff.module';

@Module({
  imports: [ConfigAppModule, AuthModule, AuditModule, HealthModule, StaffModule],
})
export class AppModule {}
