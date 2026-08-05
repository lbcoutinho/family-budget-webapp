import { type CategoryDto } from '@family-budget/api-client';
import { ChevronRightIcon, PencilIcon, PlusIcon, PowerIcon, PowerOffIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AUTOMATIC_CATEGORY_COLOR, AUTOMATIC_SUBCATEGORY_NAME } from './category-colors';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface CategoryTreeProps {
  /** Roots of the active kind, already filtered by the search box — each with its (possibly
   * filtered) `children`. */
  roots: CategoryDto[];
  /** Ids the user expanded by hand. Ignored, and read as "everything open", while search is
   * non-empty — see `expanded` on the page. */
  expandedIds: ReadonlySet<string>;
  forceExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (category: CategoryDto) => void;
  onAddSubcategory: (root: CategoryDto) => void;
  onActivate: (category: CategoryDto) => void;
  onDeactivate: (category: CategoryDto) => void;
  /** Roots only — the prototype gives no delete action to a subcategory. */
  onDelete: (root: CategoryDto) => void;
}

export function CategoryTreeSkeleton() {
  const { t } = useTranslation();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('categories.column.name')}</TableHead>
          <TableHead className="hidden shell:table-cell">{t('categories.column.subcategories')}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {[160, 120, 140].map((width) => (
          <TableRow key={width}>
            <TableCell>
              <Skeleton className="h-4" style={{ width }} />
            </TableCell>
            <TableCell className="hidden shell:table-cell" />
            <TableCell />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Root and child rows, expand/collapse, per-row actions. Pure presentation — the tree it receives
 * is already the one to render, kind-filtered and search-filtered by the page above it. */
export function CategoryTree({
  roots,
  expandedIds,
  forceExpanded,
  onToggleExpand,
  onEdit,
  onAddSubcategory,
  onActivate,
  onDeactivate,
  onDelete,
}: CategoryTreeProps) {
  const { t } = useTranslation();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('categories.column.name')}</TableHead>
          <TableHead className="hidden shell:table-cell">{t('categories.column.subcategories')}</TableHead>
          <TableHead>
            <span className="sr-only">{t('common.actions')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roots.map((root) => {
          const isExpanded = forceExpanded || expandedIds.has(root.id);
          const children = root.children ?? [];

          return (
            <RootRows
              key={root.id}
              root={root}
              children={children}
              isExpanded={isExpanded}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onAddSubcategory={onAddSubcategory}
              onActivate={onActivate}
              onDeactivate={onDeactivate}
              onDelete={onDelete}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}

interface RootRowsProps {
  root: CategoryDto;
  children: CategoryDto[];
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (category: CategoryDto) => void;
  onAddSubcategory: (root: CategoryDto) => void;
  onActivate: (category: CategoryDto) => void;
  onDeactivate: (category: CategoryDto) => void;
  onDelete: (root: CategoryDto) => void;
}

function RootRows({ root, children, isExpanded, onToggleExpand, onEdit, onAddSubcategory, onActivate, onDeactivate, onDelete }: RootRowsProps) {
  const { t } = useTranslation();

  return (
    <>
      <TableRow className={cn(!root.isActive && 'text-muted-foreground')}>
        <TableCell>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-label={t(isExpanded ? 'categories.collapse' : 'categories.expand', { name: root.name })}
              className="grid size-6 flex-none place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => onToggleExpand(root.id)}
            >
              <ChevronRightIcon className={cn('size-3.5 transition-transform', isExpanded && 'rotate-90')} />
            </button>
            <span
              className={cn('size-2.5 flex-none rounded-sm', !root.isActive && 'opacity-40')}
              style={{ background: root.color ?? AUTOMATIC_CATEGORY_COLOR }}
            />
            <span className={cn('font-medium', !root.isActive && 'font-normal')}>{root.name}</span>
            {!root.isActive && <Badge variant="outline">{t('categories.badge.inactive')}</Badge>}
          </div>
        </TableCell>
        <TableCell className="hidden shell:table-cell text-muted-foreground tabular-nums">
          <div className="flex items-center gap-2">
            <span>{children.length}</span>
            <Button
              variant="outline"
              size="sm"
              className="border-dashed"
              aria-label={t('categories.addSubcategoryFor', { name: root.name })}
              onClick={() => onAddSubcategory(root)}
            >
              <PlusIcon /> {t('categories.addSubcategory')}
            </Button>
          </div>
        </TableCell>
        <TableCell>
          <RowActions category={root} onEdit={onEdit} onActivate={onActivate} onDeactivate={onDeactivate} onDelete={onDelete} />
        </TableCell>
      </TableRow>

      {isExpanded &&
        children.map((child) => (
          <TableRow key={child.id} className={cn(!child.isActive && 'text-muted-foreground')}>
            <TableCell className="pl-11">
              <span className={cn(!child.isActive && 'font-normal')}>{child.name}</span>{' '}
              {!child.isActive && <Badge variant="outline">{t('categories.badge.inactive')}</Badge>}
              {child.name === AUTOMATIC_SUBCATEGORY_NAME && <Badge variant="outline">{t('categories.badge.automatic')}</Badge>}
            </TableCell>
            <TableCell className="hidden shell:table-cell" />
            <TableCell>
              <RowActions category={child} onEdit={onEdit} onActivate={onActivate} onDeactivate={onDeactivate} />
            </TableCell>
          </TableRow>
        ))}

      {isExpanded && (
        <TableRow className="shell:hidden">
          <TableCell colSpan={3}>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              aria-label={t('categories.addSubcategoryFor', { name: root.name })}
              onClick={() => onAddSubcategory(root)}
            >
              <PlusIcon /> {t('categories.addSubcategory')}
            </Button>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

interface RowActionsProps {
  category: CategoryDto;
  onEdit: (category: CategoryDto) => void;
  onActivate: (category: CategoryDto) => void;
  onDeactivate: (category: CategoryDto) => void;
  /** Present on a root row only — a subcategory has no delete action in this screen. */
  onDelete?: (category: CategoryDto) => void;
}

function RowActions({ category, onEdit, onActivate, onDeactivate, onDelete }: RowActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex justify-end gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t('common.edit')} onClick={() => onEdit(category)}>
            <PencilIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('common.edit')}</TooltipContent>
      </Tooltip>
      {category.isActive ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('categories.action.deactivate')} onClick={() => onDeactivate(category)}>
              <PowerOffIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('categories.action.deactivate')}</TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('categories.action.activate')} onClick={() => onActivate(category)}>
              <PowerIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('categories.action.activate')}</TooltipContent>
        </Tooltip>
      )}
      {onDelete && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('common.delete')} onClick={() => onDelete(category)}>
              <Trash2Icon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('common.delete')}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
