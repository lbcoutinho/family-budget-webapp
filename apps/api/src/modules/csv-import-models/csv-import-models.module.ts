import { Module } from '@nestjs/common';

import { CsvImportModelsController } from './csv-import-models.controller';
import { CsvImportModelsService } from './csv-import-models.service';

@Module({
  controllers: [CsvImportModelsController],
  providers: [CsvImportModelsService],
})
export class CsvImportModelsModule {}
