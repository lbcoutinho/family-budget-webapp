import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Request body of `POST /api/cashboxes`. `userId` is never accepted from a client — it comes from the token. */
export class CreateCashboxDto {
  @ApiProperty({ type: String, maxLength: 80, example: 'Fundo de emergência' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  // `@IsOptional()` skips validation for null as well as undefined, which is what lets an edit form
  // clear the field by sending `null` rather than having to omit it.
  @ApiProperty({ type: String, required: false, nullable: true, maxLength: 500, example: 'Seis meses de despesas fixas.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    example: 500_000,
    description: 'Goal, in **cents** (ADR-0005) — never a decimal. Null or omitted means no goal; it never enters a balance calculation.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  targetAmount?: number | null;

  @ApiProperty({ type: Boolean, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: Number, required: false, default: 0, description: "Position in the user's own ordering of the list." })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
