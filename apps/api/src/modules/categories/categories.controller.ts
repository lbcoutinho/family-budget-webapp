import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { ApiErrorDto } from '../../common/api-error';
import { type AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { CategoriesService } from './categories.service';
import { CategoryDto } from './dto/category.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

/**
 * HTTP for the categories master data (M3-T04). No `@Public()` anywhere: the global `JwtAuthGuard`
 * protects every route here, and `@CurrentUser()` is what scopes each one to its owner.
 *
 * The 404 documented on every by-id route covers both "no such category" and "not yours" — telling
 * them apart would confirm the id exists to whoever asked.
 *
 * Bodies and query parameters are declared with `@ApiBody` / `@ApiQuery` even though the argument
 * types already say so: the swagger CLI plugin is not enabled, so a parameter Nest cannot see ends
 * up missing from `openapi.json` — and therefore from the generated client's signature, silently.
 */
@ApiTags('categories')
@ApiNotFoundResponse({ type: ApiErrorDto, description: 'No such category — or it belongs to another user.' })
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @ApiOperation({ operationId: 'listCategories', summary: "List the user's categories" })
  @ApiQuery({ name: 'tree', type: Boolean, required: false, description: 'Nest subcategories under their root. Flat list by default.' })
  @ApiQuery({ name: 'includeInactive', type: Boolean, required: false, description: 'Include deactivated categories. Off by default.' })
  @ApiQuery({ name: 'includeId', type: String, format: 'uuid', required: false, description: 'Also return this one category, active or not.' })
  @ApiOkResponse({ type: [CategoryDto], description: 'Ordered by sort order and then name, within each level.' })
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListCategoriesQueryDto): Promise<CategoryDto[]> {
    return this.categories.findAll(user.id, query);
  }

  @ApiOperation({ operationId: 'getCategory', summary: 'Read one category' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: CategoryDto })
  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<CategoryDto> {
    return this.categories.findOne(user.id, id);
  }

  @ApiOperation({
    operationId: 'createCategory',
    summary: 'Create a category',
    description: 'A root category is created together with an automatic "Outros" subcategory, so a transaction always has somewhere to go.',
  })
  @ApiBody({ type: CreateCategoryDto })
  @ApiCreatedResponse({ type: CategoryDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'The parent is itself a subcategory, the kind does not match the parent, or a subcategory was given a colour.',
  })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'The user already has a category with that name at that level.' })
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categories.create(user.id, dto);
  }

  @ApiOperation({ operationId: 'updateCategory', summary: 'Update a category' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiOkResponse({ type: CategoryDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'The move would make the tree three levels deep, or the kind does not match the parent.' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'A duplicate name, or a category with subcategories being turned into a subcategory.' })
  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto): Promise<CategoryDto> {
    return this.categories.update(user.id, id, dto);
  }

  @ApiOperation({ operationId: 'activateCategory', summary: 'Put a retired category back into use', description: 'On a root, its subcategories follow.' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: CategoryDto })
  @Patch(':id/activate')
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<CategoryDto> {
    return this.categories.setActive(user.id, id, true);
  }

  @ApiOperation({ operationId: 'deactivateCategory', summary: 'Retire a category, keeping its history', description: 'On a root, its subcategories follow.' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: CategoryDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'This is the last active subcategory of an active category.' })
  @Patch(':id/deactivate')
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<CategoryDto> {
    return this.categories.setActive(user.id, id, false);
  }

  @ApiOperation({ operationId: 'deleteCategory', summary: 'Delete a category for good' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Deleted. Nothing referenced it.' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Subcategories or records still reference this category — deactivate it instead of deleting it.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(user.id, id);
  }
}
