import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Exists only to prove the auth/RBAC chain (token verification + custom
   * claims + RolesGuard) works end-to-end against the emulator in Phase 1.
   * Not a real business endpoint — Phase 2 introduces the first one.
   */
  @Roles('studio_manager')
  @Get('secure')
  checkSecure() {
    return { status: 'ok', authenticated: true };
  }
}
