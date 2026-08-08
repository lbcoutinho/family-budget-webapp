import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { type AuthUserDto } from '../auth/dto/auth-user.dto';

import { type UpdateUserDto } from './dto/update-user.dto';

/**
 * `PATCH /users/me`. Field-by-field `select`, same reason as `AuthService.validateUser`:
 * `passwordHash` must have no path into a response.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateCurrentUser(userId: string, dto: UpdateUserDto): Promise<AuthUserDto> {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: { id: true, email: true, name: true, locale: true },
    });
  }
}
