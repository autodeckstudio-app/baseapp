import { Body, Controller, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { RestockInventoryItemDto } from './dto/restock-inventory-item.dto';
import { RecordInventoryUsageDto } from './dto/record-inventory-usage.dto';
import { InventoryService } from './inventory.service';

/**
 * Create/update/restock are `@Roles('studio_manager')` — per the approved
 * product decisions, "Studio Manager: manage... inventory," contrasted
 * with Staff's narrower "record inventory usage" (the one `staff`-tier
 * route here). No read endpoint: the `inventory`/`inventoryUsage`
 * collections are already readable directly against Firestore by their
 * existing staff-plus-only rules.
 */
@Controller('inventory-items')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Roles('studio_manager')
  @Post()
  create(@Body() dto: CreateInventoryItemDto, @Req() req: Request) {
    return this.inventoryService.createInventoryItem(req.authUser!, dto);
  }

  @Roles('studio_manager')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInventoryItemDto, @Req() req: Request) {
    return this.inventoryService.updateInventoryItem(req.authUser!, id, dto);
  }

  @Roles('studio_manager')
  @Patch(':id/restock')
  restock(@Param('id') id: string, @Body() dto: RestockInventoryItemDto, @Req() req: Request) {
    return this.inventoryService.restock(req.authUser!, id, dto);
  }

  @Roles('staff')
  @Post(':id/usage')
  recordUsage(@Param('id') id: string, @Body() dto: RecordInventoryUsageDto, @Req() req: Request) {
    return this.inventoryService.recordUsage(req.authUser!, id, dto);
  }
}
