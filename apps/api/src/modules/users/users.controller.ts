import { Body, Controller, Patch } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { type AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUserDto } from '../auth/dto/auth-user.dto';

import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

/** The global `JwtAuthGuard` already protects this route; `@CurrentUser()` scopes it to the caller. */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @ApiOperation({ operationId: 'updateCurrentUser', summary: "Update the caller's own account" })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ type: AuthUserDto })
  @Patch('me')
  updateCurrentUser(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserDto): Promise<AuthUserDto> {
    return this.users.updateCurrentUser(user.id, dto);
  }
}
