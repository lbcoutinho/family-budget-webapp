import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsInt, IsUUID, Min } from 'class-validator';

export class CsvImportRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  modelId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  accountId!: string;
}

export class ConfirmCsvImportDto extends CsvImportRequestDto {
  @ApiProperty({ type: [Number], example: [2, 3] })
  @Transform(({ value }: { value: unknown }) => {
    if (Array.isArray(value)) return value.map(Number);
    if (typeof value !== 'string') return value;
    if (value.startsWith('[')) {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return value;
      }
    }
    return [Number(value)];
  })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  selectedLines!: number[];
}
