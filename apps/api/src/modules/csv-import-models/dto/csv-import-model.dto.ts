import { ApiProperty } from '@nestjs/swagger';

export class CsvImportModelDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: Number })
  headerLineCount!: number;

  @ApiProperty({ type: String, enum: [',', ';', '\t'] })
  separator!: ',' | ';' | '\t';

  @ApiProperty({ type: String })
  dateHeader!: string;

  @ApiProperty({ type: String })
  descriptionHeader!: string;

  @ApiProperty({ type: String })
  amountHeader!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
