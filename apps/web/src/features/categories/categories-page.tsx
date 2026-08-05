import {
  type CategoryDto,
  type CategoryKind,
  getListCategoriesQueryKey,
  useActivateCategory,
  useCreateCategory,
  useDeactivateCategory,
  useDeleteCategory,
  useListCategories,
  useUpdateCategory,
} from '@family-budget/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { PlusIcon, SearchIcon, TagsIcon, TriangleAlertIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { type CategoryDialogSubmitValues, CategoryDialog } from './category-dialog';
import { CategoryTree, CategoryTreeSkeleton } from './category-tree';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { PageContent, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type TranslationKey } from '@/i18n';
import { apiErrorMessage } from '@/lib/api-error';

/** What the dialog is open for. `parent` is what switches it between a root and a subcategory
 * form; presence of `category` is what switches it between create and edit. */
type DialogState =
  | { mode: 'new-root' }
  | { mode: 'edit-root'; category: CategoryDto }
  | { mode: 'new-child'; parent: CategoryDto }
  | { mode: 'edit-child'; category: CategoryDto; parent: CategoryDto };

function apiErrorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { code?: string } } } | null)?.response?.data?.code;
}

export function CategoriesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [activeKind, setActiveKind] = useState<CategoryKind>('EXPENSE');
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<DialogState | null>(null);
  const [deactivating, setDeactivating] = useState<CategoryDto | null>(null);
  const [deleting, setDeleting] = useState<CategoryDto | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);

  const { data, isPending, isError, refetch } = useListCategories({ tree: true, includeInactive: showInactive });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });

  const createCategory = useCreateCategory({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEditing(null);
      },
    },
  });
  const updateCategory = useUpdateCategory({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEditing(null);
      },
    },
  });
  const activateCategory = useActivateCategory({
    mutation: { onSuccess: invalidate, onError: (error) => toast.error(apiErrorMessage(error, t)) },
  });
  const deactivateCategory = useDeactivateCategory({
    mutation: {
      onSuccess: () => {
        invalidate();
        setDeactivating(null);
      },
      onError: (error) => toast.error(apiErrorMessage(error, t)),
    },
  });
  const deleteCategory = useDeleteCategory({
    mutation: {
      onSuccess: () => {
        invalidate();
        setDeleting(null);
        setDeleteBlocked(false);
      },
      onError: (error) => {
        if (apiErrorCode(error) === 'RECORD_IN_USE') {
          setDeleteBlocked(true);

          return;
        }

        toast.error(apiErrorMessage(error, t));
        setDeleting(null);
      },
    },
  });

  const searchLower = search.trim().toLowerCase();

  // "A root matches if its own name or any child's matches; a matching root shows only its
  // matching children" — filtering happens on the loaded tree only, which is fine at a dozen
  // categories.
  const displayRoots = useMemo(() => {
    const kindRoots = (data ?? []).filter((root) => root.kind === activeKind);

    if (searchLower === '') {
      return kindRoots;
    }

    return kindRoots.flatMap((root) => {
      const rootMatches = root.name.toLowerCase().includes(searchLower);
      const matchingChildren = (root.children ?? []).filter((child) => child.name.toLowerCase().includes(searchLower));

      return rootMatches || matchingChildren.length > 0 ? [{ ...root, children: matchingChildren }] : [];
    });
  }, [data, activeKind, searchLower]);

  function toggleExpand(id: string) {
    setExpandedIds((previous) => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function openEdit(category: CategoryDto) {
    if (category.parentId === null) {
      setEditing({ mode: 'edit-root', category });

      return;
    }

    const parent = (data ?? []).find((root) => root.id === category.parentId);

    if (parent) {
      setEditing({ mode: 'edit-child', category, parent });
    }
  }

  function submitDialog(values: CategoryDialogSubmitValues) {
    if (!editing) {
      return;
    }

    switch (editing.mode) {
      case 'new-root':
        createCategory.mutate({ data: { name: values.name, kind: values.kind, color: values.color } });
        break;
      case 'edit-root':
        updateCategory.mutate({ id: editing.category.id, data: { name: values.name, kind: values.kind, color: values.color } });
        break;
      case 'new-child':
        createCategory.mutate({ data: { name: values.name, parentId: editing.parent.id } });
        break;
      case 'edit-child':
        updateCategory.mutate({ id: editing.category.id, data: { name: values.name } });
        break;
    }
  }

  const dialogMutation = editing?.mode === 'new-root' || editing?.mode === 'new-child' ? createCategory : updateCategory;
  const deactivatingChildren = deactivating ? ((data ?? []).find((root) => root.id === deactivating.id)?.children ?? []) : [];

  return (
    <>
      <PageHeader
        title={t('nav.categories')}
        actions={
          <Button size="sm" onClick={() => setEditing({ mode: 'new-root' })}>
            <PlusIcon />
            {t('categories.new')}
          </Button>
        }
      />
      <PageContent>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Tabs value={activeKind} onValueChange={(value) => setActiveKind(value as CategoryKind)}>
            <TabsList>
              <TabsTrigger value="EXPENSE">{t('categories.kind.EXPENSE')}</TabsTrigger>
              <TabsTrigger value="INCOME">{t('categories.kind.INCOME')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full shell:w-[210px]">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t('categories.search')} className="pl-8" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} aria-label={t('categories.showInactive')} />
              {t('categories.showInactive')}
            </label>
          </div>
        </div>

        <Card className="py-0">
          {isPending && <CategoryTreeSkeleton />}
          {isError && (
            <EmptyState
              icon={TriangleAlertIcon}
              title={t('categories.error.title')}
              description={t('categories.error.description')}
              action={
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  {t('common.retry')}
                </Button>
              }
            />
          )}
          {!isPending && !isError && displayRoots.length === 0 && searchLower === '' && (
            <EmptyState
              icon={TagsIcon}
              title={t(`categories.empty.${activeKind}.title` as TranslationKey)}
              description={t('categories.empty.description')}
              action={
                <Button size="sm" onClick={() => setEditing({ mode: 'new-root' })}>
                  <PlusIcon />
                  {t('categories.new')}
                </Button>
              }
            />
          )}
          {!isPending && !isError && displayRoots.length === 0 && searchLower !== '' && (
            <EmptyState
              icon={SearchIcon}
              title={t('categories.empty.searchTitle', { query: search.trim() })}
              description={t('categories.empty.searchDescription')}
              action={
                <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                  {t('categories.clearSearch')}
                </Button>
              }
            />
          )}
          {!isPending && !isError && displayRoots.length > 0 && (
            <CategoryTree
              roots={displayRoots}
              expandedIds={expandedIds}
              forceExpanded={searchLower !== ''}
              onToggleExpand={toggleExpand}
              onEdit={openEdit}
              onAddSubcategory={(root) => setEditing({ mode: 'new-child', parent: root })}
              onActivate={(category) => activateCategory.mutate({ id: category.id })}
              onDeactivate={setDeactivating}
              onDelete={(root) => {
                setDeleting(root);
                setDeleteBlocked(false);
              }}
            />
          )}
        </Card>
      </PageContent>

      <CategoryDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
          }
        }}
        category={editing?.mode === 'edit-root' || editing?.mode === 'edit-child' ? editing.category : undefined}
        parent={editing?.mode === 'new-child' || editing?.mode === 'edit-child' ? editing.parent : undefined}
        defaultKind={activeKind}
        isPending={dialogMutation.isPending}
        error={dialogMutation.error}
        onSubmit={submitDialog}
      />

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title={t('categories.deactivate.title', { name: deactivating?.name ?? '' })}
        description={
          deactivating?.parentId === null
            ? t('categories.deactivate.description', { count: deactivatingChildren.length, names: deactivatingChildren.map((child) => child.name).join(', ') })
            : t('categories.deactivate.descriptionChild')
        }
        confirmLabel={t('categories.action.deactivate')}
        isPending={deactivateCategory.isPending}
        onConfirm={() => deactivating && deactivateCategory.mutate({ id: deactivating.id })}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteBlocked(false);
          }
        }}
        title={t('categories.delete.title', { name: deleting?.name ?? '' })}
        description={deleteBlocked ? apiErrorMessage(deleteCategory.error, t) : t('categories.delete.description')}
        confirmLabel={deleteBlocked ? t('categories.action.deactivate') : t('common.delete')}
        cancelLabel={deleteBlocked ? t('common.close') : undefined}
        variant={deleteBlocked ? 'default' : 'destructive'}
        isPending={deleteCategory.isPending || deactivateCategory.isPending}
        onConfirm={() => {
          if (!deleting) {
            return;
          }

          if (deleteBlocked) {
            deactivateCategory.mutate(
              { id: deleting.id },
              {
                onSuccess: () => {
                  setDeleting(null);
                  setDeleteBlocked(false);
                },
              },
            );

            return;
          }

          deleteCategory.mutate({ id: deleting.id });
        }}
      />
    </>
  );
}
