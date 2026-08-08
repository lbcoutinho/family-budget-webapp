import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

/** Kept in sync with the web's `SUPPORTED_LOCALES` (`apps/web/src/i18n/index.ts`) by hand — no shared package for two entries. */
export const SUPPORTED_LOCALES = ['pt-BR', 'en-US'] as const;

/**
 * Only `locale` is writable through this endpoint. `name`/`email` are out of scope, and the
 * global `ValidationPipe`'s `forbidNonWhitelisted` already turns an attempt to patch them into a
 * 400.
 *
 * `type` is stated explicitly on `@ApiPropertyOptional` — the OpenAPI export runs under `tsx`,
 * which emits no `design:type` metadata, so a bare decorator breaks `pnpm gen` (same note as
 * `accounts/dto/account.dto.ts`).
 */
export class UpdateUserDto {
  @ApiPropertyOptional({ type: String, enum: SUPPORTED_LOCALES, example: 'en-US' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string;
}
