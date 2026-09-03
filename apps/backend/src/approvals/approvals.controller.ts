import { Body, Controller, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { RequestApprovalDto } from './dto/request-approval.dto';
import { ResolveApprovalDto } from './dto/resolve-approval.dto';
import { ApprovalsService } from './approvals.service';

/**
 * Staff-minimum for every route here, same tier as Bookings/Visits — per
 * the approved product decisions (§F), "approval-request initiation" is
 * listed as ordinary studio-app staff work, not a Studio-Manager/Owner
 * privilege (unlike ServicesController's pricing-catalogue routes).
 *
 * Request is nested under its visit (`POST /visits/:visitId/approvals`),
 * exactly like Vehicles-under-Customers and Visits-under-Bookings, so
 * `visitId` comes only from a route parameter the server controls. Resolve
 * is a flat `/approvals/:id/resolve` route, matching the rest of this
 * codebase's `:id`-scoped action routes. There is deliberately no read
 * endpoint: an approval's own read access is already granted directly
 * against Firestore by the existing `approvals/{id}` rule.
 */
@Controller()
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Roles('staff')
  @Post('visits/:visitId/approvals')
  request(@Param('visitId') visitId: string, @Body() dto: RequestApprovalDto, @Req() req: Request) {
    return this.approvalsService.requestApproval(req.authUser!, visitId, dto);
  }

  @Roles('staff')
  @Patch('approvals/:id/resolve')
  resolve(@Param('id') id: string, @Body() dto: ResolveApprovalDto, @Req() req: Request) {
    return this.approvalsService.resolveApproval(req.authUser!, id, dto);
  }
}
