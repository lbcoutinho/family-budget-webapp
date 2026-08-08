import { ApiProperty } from '@nestjs/swagger';

import { SUPPORTED_LOCALES } from '../../users/dto/update-user.dto';

/**
 * The authenticated account as the API hands it out. Deliberately not the Prisma `User`: that
 * one carries `passwordHash`, and the surest way never to leak it is to have no type in the
 * response layer that can hold it.
 */
export class AuthUserDto {
  @ApiProperty({ type: String, format: 'uuid', example: '6f9619ff-8b86-d011-b42d-00c04fc964ff' })
  id!: string;

  @ApiProperty({ type: String, example: 'person@example.com' })
  email!: string;

  @ApiProperty({ type: String, example: 'person', description: 'Display name.' })
  name!: string;

  @ApiProperty({ type: String, enum: SUPPORTED_LOCALES, example: 'pt-BR' })
  locale!: string;
}
