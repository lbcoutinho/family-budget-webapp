import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

import { CategoryKind } from '../../../generated/prisma/client';

/** Request body of `POST /api/categories`. `userId` is never accepted from a client — it comes from the token. */
export class CreateCategoryDto {
  @ApiProperty({ type: String, maxLength: 80, example: 'Alimentação' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    required: false,
    description: 'Omit for a root category. Given, it must be a root: the tree is at most two levels deep.',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiProperty({
    enum: CategoryKind,
    enumName: 'CategoryKind',
    required: false,
    description: 'Required on a root. On a subcategory it is inherited from the parent, so it may only be sent if it matches.',
  })
  @IsOptional()
  @IsEnum(CategoryKind)
  kind?: CategoryKind;

  @ApiProperty({ type: String, required: false, nullable: true, example: '#a85c1a', description: '`#RRGGBB`. Roots only.' })
  @IsOptional()
  // Null is a normal state — a category without a colour falls back to one derived from its id —
  // so the pattern only has to hold for the strings.
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a hex value in the form #RRGGBB.' })
  color?: string | null;

  @ApiProperty({ type: Boolean, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: Number, required: false, default: 0, description: "Position in the user's own ordering, within its own level." })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
