import { type CategoryKind, useGetCategory, useListCategories } from '@family-budget/api-client';
import { type Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { FieldError } from '@/components/field-error';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface CategorySelectProps {
  kind: CategoryKind;
  categoryId: string | undefined;
  subcategoryId: string | undefined;
  onChange: (categoryId: string | undefined, subcategoryId: string | undefined) => void;
  disabled?: boolean;
  categoryError?: string;
  subcategoryError?: string;
  categoryRef?: Ref<HTMLButtonElement>;
  subcategoryRef?: Ref<HTMLButtonElement>;
  idPrefix?: string;
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
  categoryError,
  subcategoryError,
  categoryRef,
  subcategoryRef,
  idPrefix = 'entry',
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
      <div className="grid min-w-0 content-start gap-1.5">
        <Label htmlFor={`${idPrefix}-category`}>{t('transactions.field.category')}</Label>
        <Select value={categoryId} onValueChange={(value) => onChange(value, undefined)} disabled={disabled}>
          <SelectTrigger
            ref={categoryRef}
            id={`${idPrefix}-category`}
            className="w-full min-w-0"
            aria-describedby={categoryError ? `${idPrefix}-category-error` : undefined}
            aria-invalid={categoryError !== undefined}
          >
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
        <FieldError id={`${idPrefix}-category-error`} error={categoryError} />
      </div>

      <div className="grid min-w-0 content-start gap-1.5">
        <Label htmlFor={`${idPrefix}-subcategory`}>{t('transactions.field.subcategory')}</Label>
        <Select value={subcategoryId} onValueChange={(value) => onChange(categoryId, value)} disabled={(disabled ?? false) || categoryId === undefined}>
          <SelectTrigger
            ref={subcategoryRef}
            id={`${idPrefix}-subcategory`}
            className="w-full min-w-0"
            aria-describedby={subcategoryError ? `${idPrefix}-subcategory-error` : undefined}
            aria-invalid={subcategoryError !== undefined}
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
        <FieldError id={`${idPrefix}-subcategory-error`} error={subcategoryError} />
      </div>
    </>
  );
}
