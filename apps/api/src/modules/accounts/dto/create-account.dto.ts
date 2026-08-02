import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Request body of `POST /api/accounts`. `userId` is never accepted from a client — it comes from the token. */
export class CreateAccountDto {
  @ApiProperty({ type: String, maxLength: 80, example: 'Millennium' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

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
