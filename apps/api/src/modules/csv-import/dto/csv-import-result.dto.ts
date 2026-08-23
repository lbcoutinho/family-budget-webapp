import { ApiProperty } from '@nestjs/swagger';

export class CsvImportRowDto {
  @ApiProperty({ type: Number })
  line!: number;

  @ApiProperty({ type: String, required: false })
  reason?: string;
}

export class CsvImportResultDto {
  @ApiProperty({ type: [CsvImportRowDto] })
  new!: CsvImportRowDto[];

  @ApiProperty({ type: [CsvImportRowDto] })
  duplicate!: CsvImportRowDto[];

  @ApiProperty({ type: [CsvImportRowDto] })
  invalid!: CsvImportRowDto[];

  @ApiProperty({ type: [CsvImportRowDto] })
  notSelected!: CsvImportRowDto[];
}
