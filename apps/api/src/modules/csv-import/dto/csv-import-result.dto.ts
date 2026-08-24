import { ApiProperty } from '@nestjs/swagger';

export class CsvImportRowDto {
  @ApiProperty({ type: Number })
  line!: number;

  @ApiProperty({ type: String, required: false, description: 'Date from the CSV row. Valid rows use `YYYY-MM-DD`.' })
  date?: string;

  @ApiProperty({ type: String, required: false })
  description?: string;

  @ApiProperty({ type: Number, required: false, description: 'Always positive, in cents.' })
  amount?: number;

  @ApiProperty({ type: String, enum: ['INCOME', 'EXPENSE'], required: false })
  type?: 'INCOME' | 'EXPENSE';

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
