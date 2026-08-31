import { Body, Controller, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';
import { StaffService } from './staff.service';

/**
 * Minimum role at the guard level is `studio_manager` for every route here
 * — Studio Manager can act on Staff-tier accounts. The finer rule (only
 * Owner/Admin may touch anything at the Studio Manager/Owner tier) is
 * enforced inside StaffService, not by RolesGuard, since RolesGuard only
 * ever checks the caller's own role against a static minimum, not a
 * caller-vs-target comparison.
 */
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Roles('studio_manager')
  @Post()
  create(@Body() dto: CreateStaffDto, @Req() req: Request) {
    return this.staffService.createStaff(req.authUser!, dto);
  }

  @Roles('studio_manager')
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string, @Req() req: Request) {
    return this.staffService.deactivateStaff(req.authUser!, id);
  }

  @Roles('studio_manager')
  @Patch(':id/role')
  changeRole(@Param('id') id: string, @Body() dto: UpdateStaffRoleDto, @Req() req: Request) {
    return this.staffService.changeStaffRole(req.authUser!, id, dto.role);
  }
}
