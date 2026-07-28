import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../modules/auth/decorators/public.decorator';

import { HealthStatusDto } from './dto/health-status.dto';
import { HealthService } from './health.service';

// A liveness probe that needs credentials is not a liveness probe: whatever polls it — a
// container orchestrator, an uptime monitor — has no account and no way to log in.
@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  // `operationId` is fixed here so the generated client hook is `useGetHealth` rather than the
  // default `useHealthControllerCheck`. Every endpoint sets its own for stable client names.
  @ApiOperation({ operationId: 'getHealth', summary: 'Liveness check for the API and its database' })
  @ApiOkResponse({ type: HealthStatusDto, description: 'The API is up and the database answered `SELECT 1`.' })
  @Get()
  check(): Promise<HealthStatusDto> {
    return this.health.check();
  }
}
