import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { type AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { AssetListingDto } from './dto/asset-listing.dto';
import { CreateAssetListingDto } from './dto/create-asset-listing.dto';
import { CreateFinancialInstitutionDto } from './dto/create-financial-institution.dto';
import { CreateInstrumentDto } from './dto/create-instrument.dto';
import { FinancialInstitutionDto } from './dto/financial-institution.dto';
import { InstrumentDto } from './dto/instrument.dto';
import { ListInvestmentSetupQueryDto } from './dto/list-investment-setup-query.dto';
import { UpdateAssetListingDto } from './dto/update-asset-listing.dto';
import { UpdateFinancialInstitutionDto } from './dto/update-financial-institution.dto';
import { UpdateInstrumentDto } from './dto/update-instrument.dto';
import { InvestmentsService } from './investments.service';

@ApiQuery({ name: 'includeInactive', type: Boolean, required: false })
class InvestmentSetupController {
  constructor(protected readonly investments: InvestmentsService) {}
}

@ApiTags('financial-institutions')
@Controller('financial-institutions')
export class FinancialInstitutionsController extends InvestmentSetupController {
  @ApiOperation({ operationId: 'listFinancialInstitutions' })
  @ApiOkResponse({ type: [FinancialInstitutionDto] })
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListInvestmentSetupQueryDto) {
    return this.investments.listInstitutions(user.id, query);
  }
  @ApiOperation({ operationId: 'createFinancialInstitution' })
  @ApiBody({ type: CreateFinancialInstitutionDto })
  @ApiCreatedResponse({ type: FinancialInstitutionDto })
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFinancialInstitutionDto) {
    return this.investments.createInstitution(user.id, dto);
  }
  @ApiOperation({ operationId: 'updateFinancialInstitution' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateFinancialInstitutionDto })
  @ApiOkResponse({ type: FinancialInstitutionDto })
  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFinancialInstitutionDto) {
    return this.investments.updateInstitution(user.id, id, dto);
  }
  @ApiOperation({ operationId: 'activateFinancialInstitution' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: FinancialInstitutionDto })
  @Patch(':id/activate')
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.investments.setInstitutionActive(user.id, id, true);
  }
  @ApiOperation({ operationId: 'deactivateFinancialInstitution' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: FinancialInstitutionDto })
  @Patch(':id/deactivate')
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.investments.setInstitutionActive(user.id, id, false);
  }
  @ApiOperation({ operationId: 'deleteFinancialInstitution' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.investments.removeInstitution(user.id, id);
  }
}

@ApiTags('instruments')
@Controller('instruments')
export class InstrumentsController extends InvestmentSetupController {
  @ApiOperation({ operationId: 'listInstruments' })
  @ApiOkResponse({ type: [InstrumentDto] })
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListInvestmentSetupQueryDto) {
    return this.investments.listInstruments(user.id, query);
  }
  @ApiOperation({ operationId: 'createInstrument' })
  @ApiBody({ type: CreateInstrumentDto })
  @ApiCreatedResponse({ type: InstrumentDto })
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInstrumentDto) {
    return this.investments.createInstrument(user.id, dto);
  }
  @ApiOperation({ operationId: 'updateInstrument' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateInstrumentDto })
  @ApiOkResponse({ type: InstrumentDto })
  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInstrumentDto) {
    return this.investments.updateInstrument(user.id, id, dto);
  }
  @ApiOperation({ operationId: 'activateInstrument' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: InstrumentDto })
  @Patch(':id/activate')
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.investments.setInstrumentActive(user.id, id, true);
  }
  @ApiOperation({ operationId: 'deactivateInstrument' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: InstrumentDto })
  @Patch(':id/deactivate')
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.investments.setInstrumentActive(user.id, id, false);
  }
  @ApiOperation({ operationId: 'deleteInstrument' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.investments.removeInstrument(user.id, id);
  }
}

@ApiTags('asset-listings')
@Controller('asset-listings')
export class AssetListingsController extends InvestmentSetupController {
  @ApiOperation({ operationId: 'listAssetListings' })
  @ApiOkResponse({ type: [AssetListingDto] })
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListInvestmentSetupQueryDto) {
    return this.investments.listListings(user.id, query);
  }
  @ApiOperation({ operationId: 'createAssetListing' })
  @ApiBody({ type: CreateAssetListingDto })
  @ApiCreatedResponse({ type: AssetListingDto })
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAssetListingDto) {
    return this.investments.createListing(user.id, dto);
  }
  @ApiOperation({ operationId: 'updateAssetListing' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateAssetListingDto })
  @ApiOkResponse({ type: AssetListingDto })
  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssetListingDto) {
    return this.investments.updateListing(user.id, id, dto);
  }
  @ApiOperation({ operationId: 'activateAssetListing' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AssetListingDto })
  @Patch(':id/activate')
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.investments.setListingActive(user.id, id, true);
  }
  @ApiOperation({ operationId: 'deactivateAssetListing' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AssetListingDto })
  @Patch(':id/deactivate')
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.investments.setListingActive(user.id, id, false);
  }
  @ApiOperation({ operationId: 'deleteAssetListing' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.investments.removeListing(user.id, id);
  }
}
