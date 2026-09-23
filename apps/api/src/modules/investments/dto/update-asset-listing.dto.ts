import { PartialType } from '@nestjs/swagger';

import { CreateAssetListingDto } from './create-asset-listing.dto';
export class UpdateAssetListingDto extends PartialType(CreateAssetListingDto) {}
