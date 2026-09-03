import { Body, Controller, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

/**
 * Studio-Manager-minimum for every route here — deliberately stricter than
 * CustomersController/VehiclesController's staff-minimum. Those are routine
 * day-to-day data entry; this is pricing-catalogue control, and the task's
 * own emphasis ("the client must never be able to arbitrarily set or
 * override pricing") is best read as pricing being a manager-level
 * decision, not something every staff-tier account should be able to
 * change unilaterally. This mirrors StaffController's choice to gate its
 * own sensitive, foundational-configuration routes above the base staff
 * tier. There is deliberately no read endpoint: the catalogue is already
 * readable directly against Firestore by the existing `services/{id}` rule
 * (`allow read: if isSignedIn()`), so no backend GET route is needed —
 * mirroring StaffController/CustomersController/VehiclesController, none of
 * which have read endpoints either.
 */
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Roles('studio_manager')
  @Post()
  create(@Body() dto: CreateServiceDto, @Req() req: Request) {
    return this.servicesService.createService(req.authUser!, dto);
  }

  @Roles('studio_manager')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto, @Req() req: Request) {
    return this.servicesService.updateService(req.authUser!, id, dto);
  }
}
