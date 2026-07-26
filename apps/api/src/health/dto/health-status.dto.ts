import { ApiProperty } from '@nestjs/swagger';

/**
 * Response body of `GET /api/health`. A class (not the `HealthStatus` interface) so that
 * `@nestjs/swagger` can introspect it and Orval can generate a typed model from it.
 */
export class HealthStatusDto {
  @ApiProperty({ enum: ['ok'], example: 'ok', description: 'Liveness of the API process.' })
  status!: 'ok';

  @ApiProperty({ enum: ['up'], example: 'up', description: 'Result of the database round-trip (`SELECT 1`).' })
  db!: 'up';
}
