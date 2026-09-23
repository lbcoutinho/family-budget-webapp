import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

import { AccountKind } from '../../../generated/prisma/client';

import { CreateAccountInitialBalanceDto } from './create-account-initial-balance.dto';

/** Request body of `POST /api/accounts`. `userId` is never accepted from a client — it comes from the token. */
export class CreateAccountDto {
  @ApiProperty({ type: String, maxLength: 80, example: 'Millennium' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: AccountKind, enumName: 'AccountKind', required: false, default: AccountKind.BANK })
  @IsOptional()
  @IsEnum(AccountKind)
  kind?: AccountKind;

  @ApiProperty({ type: String, format: 'uuid', required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  financialInstitutionId?: string | null;

  @ApiProperty({ type: [CreateAccountInitialBalanceDto], required: false })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateAccountInitialBalanceDto)
  initialBalances?: CreateAccountInitialBalanceDto[];

  @ApiProperty({
    type: Number,
    required: false,
    default: 0,
    example: 150000,
    description: 'Balance the account already held, in **cents** (ADR-0005) — never a decimal. May be negative.',
  })
  @IsOptional()
  @IsInt()
  initialBalance?: number;

  @ApiProperty({ type: Boolean, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: Number, required: false, default: 0, description: "Position in the user's own ordering of the list." })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
