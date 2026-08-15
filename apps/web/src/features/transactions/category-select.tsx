import { type CategoryKind, useGetCategory, useListCategories } from '@family-budget/api-client';
import { type Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface CategorySelectProps {
  kind: CategoryKind;
  categoryId: string | undefined;
  subcategoryId: string | undefined;
  onChange: (categoryId: string | undefined, subcategoryId: string | undefined) => void;
  disabled?: boolean;
  categoryDescribedBy?: string;
  subcategoryDescribedBy?: string;
  categoryInvalid?: boolean;
  subcategoryInvalid?: boolean;
  categoryRef?: Ref<HTMLButtonElement>;
  subcategoryRef?: Ref<HTMLButtonElement>;
}

/** Category + subcategory, two dependent `Select`s. Handles the case where the entry being edited
 * points at a category or subcategory that was since deactivated: `includeId` brings the root back
 * even if inactive, but a deactivated root cascades to its children, so a lone inactive subcategory
 * (root still active) falls through `includeId` — `useGetCategory` covers that gap and splices the
 * row back in, suffixed "(inativa)", so the field never renders silently empty. */
export function CategorySelect({
  kind,
  categoryId,
  subcategoryId,
  onChange,
  disabled,
  categoryDescribedBy,
  subcategoryDescribedBy,
  categoryInvalid,
  subcategoryInvalid,
  categoryRef,
  subcategoryRef,
}: CategorySelectProps) {
  const { t } = useTranslation();

  const { data: categories } = useListCategories({ tree: true, includeId: categoryId });
  const roots = (categories ?? []).filter((category) => category.kind === kind);
  const selectedRoot = roots.find((root) => root.id === categoryId);
  const rootChildren = selectedRoot?.children ?? [];

  const needsFallback = subcategoryId !== undefined && !rootChildren.some((child) => child.id === subcategoryId);
  const { data: fallbackSubcategory } = useGetCategory(subcategoryId ?? '', { query: { enabled: needsFallback } });
  const subcategories = needsFallback && fallbackSubcategory ? [...rootChildren, fallbackSubcategory] : rootChildren;

  const inactiveSuffix = ` (${t('categories.badge.inactive')})`;

  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor="entry-category">{t('transactions.field.category')}</Label>
        <Select value={categoryId} onValueChange={(value) => onChange(value, undefined)} disabled={disabled}>
          <SelectTrigger ref={categoryRef} id="entry-category" className="w-full" aria-describedby={categoryDescribedBy} aria-invalid={categoryInvalid}>
            <SelectValue placeholder={t('transactions.category.placeholder')} />
          </SelectTrigger>
          <SelectContent>
            {roots.map((root) => (
              <SelectItem key={root.id} value={root.id} disabled={!root.isActive && root.id !== categoryId}>
                {root.name}
                {!root.isActive && inactiveSuffix}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="entry-subcategory">{t('transactions.field.subcategory')}</Label>
        <Select value={subcategoryId} onValueChange={(value) => onChange(categoryId, value)} disabled={(disabled ?? false) || categoryId === undefined}>
          <SelectTrigger
            ref={subcategoryRef}
            id="entry-subcategory"
            className="w-full"
            aria-describedby={subcategoryDescribedBy}
            aria-invalid={subcategoryInvalid}
          >
            <SelectValue
              placeholder={categoryId === undefined ? t('transactions.subcategory.placeholderNoCategory') : t('transactions.subcategory.placeholder')}
            />
          </SelectTrigger>
          <SelectContent>
            {subcategories.map((subcategory) => (
              <SelectItem key={subcategory.id} value={subcategory.id} disabled={!subcategory.isActive && subcategory.id !== subcategoryId}>
                {subcategory.name}
                {!subcategory.isActive && inactiveSuffix}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
