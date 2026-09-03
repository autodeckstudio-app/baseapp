import { Body, Controller, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

/**
 * Staff-minimum for every route here — any staff-tier account may register
 * or update a customer profile. There is deliberately no read endpoint: a
 * customer's own record is already readable directly against Firestore via
 * the existing `customers/{id}` rule, and staff-side reads work the same
 * way (`isStaffPlus()`), so no backend GET route is needed — mirroring
 * StaffController, which likewise has no read endpoints.
 */
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Roles('staff')
  @Post()
  create(@Body() dto: CreateCustomerDto, @Req() req: Request) {
    return this.customersService.createCustomer(req.authUser!, dto);
  }

  @Roles('staff')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @Req() req: Request) {
    return this.customersService.updateCustomer(req.authUser!, id, dto);
  }
}
