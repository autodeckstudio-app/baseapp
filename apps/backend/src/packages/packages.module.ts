import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CustomersModule } from '../customers/customers.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { ServicesModule } from '../services/services.module';
import { PackageDefinitionsController } from './package-definitions.controller';
import { PackageDefinitionsService } from './package-definitions.service';
import { CustomerPackagesController } from './customer-packages.controller';
import { CustomerPackagesService } from './customer-packages.service';

@Module({
  imports: [AuditModule, CustomersModule, VehiclesModule, ServicesModule],
  controllers: [PackageDefinitionsController, CustomerPackagesController],
  providers: [PackageDefinitionsService, CustomerPackagesService],
})
export class PackagesModule {}
