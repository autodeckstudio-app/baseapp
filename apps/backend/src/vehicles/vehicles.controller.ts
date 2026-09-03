import { Body, Controller, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService } from './vehicles.service';

/**
 * Vehicle creation is nested under its owning customer
 * (`POST /customers/:customerId/vehicles`) so that `ownerCustomerId` comes
 * only from a route parameter the server controls — never from anything in
 * the request body, which has no such field to begin with (see
 * CreateVehicleDto). Update is a flat `/vehicles/:id` route, matching
 * StaffController's `:id`-scoped mutation routes; it can never change
 * ownership.
 */
@Controller()
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Roles('staff')
  @Post('customers/:customerId/vehicles')
  create(@Param('customerId') customerId: string, @Body() dto: CreateVehicleDto, @Req() req: Request) {
    return this.vehiclesService.createVehicle(req.authUser!, customerId, dto);
  }

  @Roles('staff')
  @Patch('vehicles/:id')
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto, @Req() req: Request) {
    return this.vehiclesService.updateVehicle(req.authUser!, id, dto);
  }
}
