import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { CreateCustomerPackageDto } from './dto/create-customer-package.dto';
import { ConsumePackageUsageDto } from './dto/consume-package-usage.dto';
import { CustomerPackagesService } from './customer-packages.service';

/**
 * Staff-minimum for both routes. Purchase-creation is a judgment call
 * (flagged in the Phase 2H implementation summary): the approved product
 * decisions say Studio Manager "manages" packages but that reads most
 * naturally as the catalogue (`PackageDefinitionsController`, elevated
 * separately); selling an existing package type to a walk-in customer is
 * routine front-desk work, analogous to BookingsController's staff-tier
 * creation route. Consumption is unambiguous: "Staff can... consume
 * package usage during service."
 *
 * Purchase is nested under its customer
 * (`POST /customers/:customerId/packages`), exactly like
 * Vehicles/Bookings-under-Customers. Consumption is nested under the
 * customer package itself (`POST /customer-packages/:id/usage`), matching
 * the `:id`-scoped action-route convention used throughout this codebase.
 * No read endpoint: both collections are already readable directly against
 * Firestore by their existing rules.
 */
@Controller()
export class CustomerPackagesController {
  constructor(private readonly customerPackagesService: CustomerPackagesService) {}

  @Roles('staff')
  @Post('customers/:customerId/packages')
  create(@Param('customerId') customerId: string, @Body() dto: CreateCustomerPackageDto, @Req() req: Request) {
    return this.customerPackagesService.createCustomerPackage(req.authUser!, customerId, dto);
  }

  @Roles('staff')
  @Post('customer-packages/:id/usage')
  consume(@Param('id') id: string, @Body() dto: ConsumePackageUsageDto, @Req() req: Request) {
    return this.customerPackagesService.consumeUsage(req.authUser!, id, dto);
  }
}
