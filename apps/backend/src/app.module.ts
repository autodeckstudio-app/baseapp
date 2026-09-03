import { Module } from '@nestjs/common';
import { ConfigAppModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { StaffModule } from './staff/staff.module';
import { CustomersModule } from './customers/customers.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { ServicesModule } from './services/services.module';
import { BookingsModule } from './bookings/bookings.module';
import { VisitsModule } from './visits/visits.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { PackagesModule } from './packages/packages.module';
import { InventoryModule } from './inventory/inventory.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ConfigAppModule,
    AuthModule,
    AuditModule,
    HealthModule,
    StaffModule,
    CustomersModule,
    VehiclesModule,
    ServicesModule,
    BookingsModule,
    VisitsModule,
    ApprovalsModule,
    PackagesModule,
    InventoryModule,
    PaymentsModule,
  ],
})
export class AppModule {}
