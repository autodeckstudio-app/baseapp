import { Body, Controller, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { CreatePackageDefinitionDto } from './dto/create-package-definition.dto';
import { UpdatePackageDefinitionDto } from './dto/update-package-definition.dto';
import { PackageDefinitionsService } from './package-definitions.service';

/**
 * Studio-Manager-minimum for every route here, matching
 * ServicesController's identical tier for pricing-catalogue control (see
 * package-definitions.service.ts's class doc). No read endpoint: the
 * catalogue is already readable directly against Firestore by the existing
 * `packageDefinitions/{id}` rule (`allow read: if isSignedIn()`).
 */
@Controller('package-definitions')
export class PackageDefinitionsController {
  constructor(private readonly packageDefinitionsService: PackageDefinitionsService) {}

  @Roles('studio_manager')
  @Post()
  create(@Body() dto: CreatePackageDefinitionDto, @Req() req: Request) {
    return this.packageDefinitionsService.createPackageDefinition(req.authUser!, dto);
  }

  @Roles('studio_manager')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePackageDefinitionDto, @Req() req: Request) {
    return this.packageDefinitionsService.updatePackageDefinition(req.authUser!, id, dto);
  }
}
