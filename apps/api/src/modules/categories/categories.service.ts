import { Injectable } from '@nestjs/common';

import { badRequest, conflict } from '../../common/api-error';
import { assertOwnership } from '../../common/assert-ownership';
import { type Category, type CategoryKind, type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import { CategoryDto } from './dto/category.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

/**
 * The subcategory every new root gets. The schema cannot express "a category always has somewhere
 * to put a transaction", so the service creates one — pt-BR, because category names are data the
 * user reads, not identifiers.
 */
export const DEFAULT_SUBCATEGORY_NAME = 'Outros';

/**
 * Master data for categories (M3-T04), on the M3-T02 pattern: every query scoped by the `userId`
 * off the token, someone else's row is a 404 rather than a 403 (`assertOwnership`), duplicate names
 * left to the database and `PrismaExceptionFilter` (P2002 → 409) instead of being pre-empted with a
 * racy read, and no HTTP decided here.
 *
 * What is specific to categories is the shape of the tree, which the schema can only half enforce.
 * Three invariants live here and nowhere else:
 *
 *  1. **Two levels, never three.** A parent must itself be a root.
 *  2. **A subcategory matches its parent's kind**, and carries no colour of its own — it inherits
 *     the parent's in the charts (`prototypes/MEMORY.md` §04).
 *  3. **An active root always has an active subcategory**, so a transaction always has somewhere to
 *     go. Hence the automatic "Outros" on creation, and the 409 on deactivating the last one.
 *
 * Writes that touch more than one row — the automatic subcategory, the deactivation cascade, a kind
 * change on a root — run in a single `$transaction`, so a tree is never left half-updated.
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The user's categories, active ones only unless asked otherwise, ordered by `sortOrder` and then
   * by name within each level. `?tree=true` nests the subcategories under their root; without it,
   * one flat list.
   */
  async findAll(userId: string, query: ListCategoriesQueryDto): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      where: { userId, ...this.visibility(query) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return query.tree === true ? toTree(rows) : rows.map(toDto);
  }

  async findOne(userId: string, id: string): Promise<CategoryDto> {
    return toDto(await this.load(userId, id));
  }

  /**
   * A subcategory is a plain insert once the parent has been checked. A root is two inserts in one
   * transaction: itself and its "Outros", because invariant 3 has to hold from the first moment.
   */
  async create(userId: string, dto: CreateCategoryDto): Promise<CategoryDto> {
    const parent = dto.parentId === undefined ? null : await this.load(userId, dto.parentId);

    if (parent !== null) {
      this.assertCanParent(parent);
      this.assertNoColour(dto.color);

      return toDto(await this.prisma.category.create({ data: { ...dto, kind: this.inheritedKind(dto.kind, parent), userId } }));
    }

    if (dto.kind === undefined) {
      throw badRequest('CATEGORY_ROOT_KIND_REQUIRED', 'A root category needs a kind.');
    }

    const kind = dto.kind;

    return this.prisma.$transaction(async (tx) => {
      const root = await tx.category.create({ data: { ...dto, kind, userId } });

      await tx.category.create({ data: { userId, parentId: root.id, name: DEFAULT_SUBCATEGORY_NAME, kind } });

      return toDto(root);
    });
  }

  /**
   * Everything a `PATCH` can break about the tree is caught here: moving a category to a new level,
   * and changing a kind out from under a subcategory.
   *
   * A root that changes kind takes its subcategories with it, in the same transaction — invariant 2
   * is not something the user should have to maintain by hand across two requests.
   *
   * ponytail: "block a kind change when transactions reference the category" (M3-T04) is not here.
   * There is no `Transaction` model until M4, so there is nothing to count; the check lands with
   * M4-T01, next to the delete-blocked 409 that is waiting on the same model.
   */
  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const current = await this.load(userId, id);
    const parentId = await this.targetParentId(userId, current, dto);
    const kind = dto.kind ?? current.kind;

    if (parentId !== null) {
      this.assertNoColour(dto.color);

      // `targetParentId` has already checked the parent of a move; what is left is a kind change on
      // a subcategory that is staying where it is.
      if (parentId === current.parentId && dto.kind !== undefined) {
        this.inheritedKind(dto.kind, await this.load(userId, parentId));
      }
    }

    if (parentId === null && kind !== current.kind) {
      return this.prisma.$transaction(async (tx) => {
        const root = await tx.category.update({ where: { id }, data: dto });

        await tx.category.updateMany({ where: { parentId: id }, data: { kind } });

        return toDto(root);
      });
    }

    return toDto(await this.prisma.category.update({ where: { id }, data: dto }));
  }

  /**
   * `PATCH /categories/:id/activate` and `/deactivate`, which is how the UI's toggle is spelled.
   *
   * A root carries its subcategories with it, both ways: deactivating one has to take them out of
   * the pickers too, and reactivating it has to give it back something to put a transaction in —
   * the children were only inactive because the parent was. A subcategory moves alone, unless it is
   * the last active one under an active root, which invariant 3 refuses.
   */
  async setActive(userId: string, id: string, isActive: boolean): Promise<CategoryDto> {
    const current = await this.load(userId, id);

    if (current.parentId === null) {
      return this.prisma.$transaction(async (tx) => {
        const root = await tx.category.update({ where: { id }, data: { isActive } });

        await tx.category.updateMany({ where: { parentId: id }, data: { isActive } });

        return toDto(root);
      });
    }

    if (!isActive) {
      await this.assertNotLastActiveSubcategory(current.parentId, current.id);
    }

    return toDto(await this.prisma.category.update({ where: { id }, data: { isActive } }));
  }

  /**
   * A real delete, not a soft one — deactivation is the soft path and it already exists. A root
   * still holding subcategories is refused by the self-relation's `onDelete: Restrict`, and once
   * transactions reference a category (M4) by that foreign key too: both surface as P2003, which
   * `PrismaExceptionFilter` turns into a 409.
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.load(userId, id);
    await this.prisma.category.delete({ where: { id } });
  }

  /** Read a row and prove it is the caller's, in one step. Every mutation starts here. */
  private async load(userId: string, id: string): Promise<Category> {
    return assertOwnership(await this.prisma.category.findUnique({ where: { id } }), userId);
  }

  /**
   * Where the row ends up, with every move rule applied. Returns the current parent untouched when
   * the patch does not mention one.
   *
   * Promotion — subcategory back to root — is unsupported, and unexpressible: `parentId` on the DTO
   * is a uuid or absent, never null, so `@IsUUID` answers 400 before this runs. A new root needs a
   * colour decision and an "Outros" of its own, which is what `POST /categories` is for.
   */
  private async targetParentId(userId: string, current: Category, dto: UpdateCategoryDto): Promise<string | null> {
    if (dto.parentId === undefined || dto.parentId === current.parentId) {
      return current.parentId;
    }

    if (dto.parentId === current.id) {
      throw badRequest('CATEGORY_SELF_PARENT', 'A category cannot be its own parent.');
    }

    const parent = await this.load(userId, dto.parentId);

    this.assertCanParent(parent);
    this.inheritedKind(dto.kind, parent);

    // The two-level rule read from the other side: this row's children would become the third level.
    if ((await this.prisma.category.count({ where: { parentId: current.id } })) > 0) {
      throw conflict('CATEGORY_HAS_SUBCATEGORIES', 'This category has subcategories, so it cannot become a subcategory itself.');
    }

    return dto.parentId;
  }

  /** Invariant 1, at the only point where a parent is chosen. */
  private assertCanParent(parent: Category): void {
    if (parent.parentId !== null) {
      throw badRequest('CATEGORY_TREE_TOO_DEEP', 'A subcategory cannot hold subcategories: the category tree is two levels deep.');
    }
  }

  /** Invariant 2, kind half. Returns the kind to write, so callers cannot forget to apply it. */
  private inheritedKind(kind: CategoryKind | undefined, parent: Category): CategoryKind {
    if (kind !== undefined && kind !== parent.kind) {
      throw badRequest('CATEGORY_SUBCATEGORY_KIND_MISMATCH', "A subcategory inherits its parent's kind, so it cannot be given a different one.");
    }

    return parent.kind;
  }

  /** Invariant 2, colour half. `null` is allowed — it is what a subcategory already holds. */
  private assertNoColour(color: string | null | undefined): void {
    if (typeof color === 'string') {
      throw badRequest('CATEGORY_SUBCATEGORY_COLOR_NOT_ALLOWED', "Only a root category carries a colour; a subcategory inherits its parent's.");
    }
  }

  /**
   * Invariant 3. Only an *active* root needs a subcategory to put things in, so the last one under
   * an already-retired root may be deactivated freely. The row itself is excluded from the count,
   * which also makes deactivating an already-inactive subcategory a no-op rather than a 409.
   */
  private async assertNotLastActiveSubcategory(parentId: string, id: string): Promise<void> {
    const parent = await this.prisma.category.findUnique({ where: { id: parentId } });

    if (parent?.isActive !== true) {
      return;
    }

    const remaining = await this.prisma.category.count({ where: { parentId, isActive: true, id: { not: id } } });

    if (remaining === 0) {
      throw conflict('CATEGORY_LAST_ACTIVE_SUBCATEGORY', 'This is the last active subcategory of an active category. Deactivate the parent category instead.');
    }
  }

  /**
   * `includeInactive` opens the list up completely; `includeId` opens it for exactly one row, which
   * is what an edit form for an older transaction needs so the category it already points at stays
   * selectable. The `OR` is built as an array because a branch of `{ id: undefined }` would match
   * every row rather than none.
   */
  private visibility(query: ListCategoriesQueryDto): Prisma.CategoryWhereInput {
    if (query.includeInactive === true) {
      return {};
    }

    return { OR: query.includeId === undefined ? [{ isActive: true }] : [{ isActive: true }, { id: query.includeId }] };
  }
}

/** Prisma row → response body. `Date`s become ISO strings, and `userId` is dropped on the floor. */
function toDto(category: Category): CategoryDto {
  return {
    id: category.id,
    parentId: category.parentId,
    name: category.name,
    kind: category.kind,
    color: category.color,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

/**
 * The flat list, nested. One pass to build the roots and one to file the children, so the order the
 * query already established survives into `children`.
 *
 * A subcategory whose root was filtered out is dropped rather than promoted: the cascade means an
 * inactive root's children are inactive too, so in practice this only happens for `?includeId` on a
 * subcategory, where a lone parentless row would misrepresent the tree.
 */
function toTree(rows: Category[]): CategoryDto[] {
  const roots = new Map<string, CategoryDto>();

  for (const row of rows) {
    if (row.parentId === null) {
      roots.set(row.id, { ...toDto(row), children: [] });
    }
  }

  for (const row of rows) {
    if (row.parentId !== null) {
      roots.get(row.parentId)?.children?.push(toDto(row));
    }
  }

  return [...roots.values()];
}
