import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * Request body of `POST /api/auth/login`, and the shape the generated client's `login(body)`
 * takes.
 *
 * Every `@ApiProperty` here states its `type` explicitly. The OpenAPI export runs under `tsx`,
 * whose esbuild transform does not emit `design:type` metadata, so a property without an explicit
 * type makes `@nestjs/swagger` fall back to the enclosing class and fail with a bogus "circular
 * dependency" error.
 */
export class LoginDto {
  @ApiProperty({ type: String, example: 'person@example.com', description: "The account's email address." })
  @IsEmail()
  email!: string;

  @ApiProperty({ type: String, example: 'correct horse battery staple', description: 'The plaintext password. Never logged, never stored.' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
