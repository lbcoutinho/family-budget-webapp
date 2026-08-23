import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class CreateCsvImportModelDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 100, example: 'Millennium' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ type: Number, minimum: 1, maximum: 100, example: 1 })
  @IsInt()
  @Min(1)
  @Max(100)
  headerLineCount!: number;

  @ApiProperty({ type: String, enum: [',', ';', '\t'], example: ';' })
  @IsIn([',', ';', '\t'])
  separator!: ',' | ';' | '\t';

  @ApiProperty({ type: String, minLength: 1, example: 'Date' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  dateHeader!: string;

  @ApiProperty({ type: String, minLength: 1, example: 'Description' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  descriptionHeader!: string;

  @ApiProperty({ type: String, minLength: 1, example: 'Amount' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  amountHeader!: string;
}
