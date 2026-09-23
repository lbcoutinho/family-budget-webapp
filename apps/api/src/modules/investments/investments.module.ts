import { Module } from '@nestjs/common';

import { AssetListingsController, FinancialInstitutionsController, InstrumentsController } from './investments.controller';
import { InvestmentsService } from './investments.service';

@Module({ controllers: [FinancialInstitutionsController, InstrumentsController, AssetListingsController], providers: [InvestmentsService] })
export class InvestmentsModule {}
