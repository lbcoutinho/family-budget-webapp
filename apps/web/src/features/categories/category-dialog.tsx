import { type CategoryDto, type CategoryKind } from '@family-budget/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import { CATEGORY_PALETTE } from './category-colors';
import { ColorPicker } from './color-picker';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type TranslationKey } from '@/i18n';
import { apiErrorMessage } from '@/lib/api-error';

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

// `kind` and `color` go through the form too (as `Controller`-wrapped custom widgets, not text
// inputs) rather than separate `useState` — resetting three plain setters in the same effect that
// opens the dialog is exactly what `react-hooks/set-state-in-effect` flags. `reset()` is the one
// call that effect is allowed to make: an external system (react-hook-form) update, not local state.
const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'categories.form.nameRequired' satisfies TranslationKey)
    .max(80, 'categories.form.nameTooLong' satisfies TranslationKey),
  kind: z.enum(['EXPENSE', 'INCOME']),
  color: z.string(),
});

type CategoryFormValues = z.infer<typeof formSchema>;

export interface CategoryDialogSubmitValues {
  name: string;
  kind?: CategoryKind;
  color?: string;
}

export interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `undefined` means create; a value means edit, and pre-fills the form. */
  category?: CategoryDto;
  /** Set for a subcategory (create or edit) — the root it belongs to, shown as a fixed label.
   * `undefined` means this dialog is for a root. */
  parent?: CategoryDto;
  /** The kind a new root defaults to — the tab that was active when "Nova categoria" was clicked.
   * Ignored for a subcategory (inherited) and for an edit (kept as it is). */
  defaultKind: CategoryKind;
  isPending: boolean;
  error: unknown;
  onSubmit: (values: CategoryDialogSubmitValues) => void;
}

/** All four cases — new/edit root, new/edit subcategory — in one dialog. `parent` is what switches
 * between a root dialog (kind tabs + colour picker) and a subcategory dialog (parent label only). */
export function CategoryDialog({ open, onOpenChange, category, parent, defaultKind, isPending, error, onSubmit }: CategoryDialogProps) {
  const { t } = useTranslation();
  const isRoot = parent === undefined;

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', kind: defaultKind, color: CATEGORY_PALETTE[0] },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: category?.name ?? '',
        kind: category?.kind ?? defaultKind,
        color: category?.color ?? CATEGORY_PALETTE[0],
      });
    }
  }, [open, category, defaultKind, reset]);

  const submit = handleSubmit((values) => {
    if (isRoot && !HEX_PATTERN.test(values.color.trim())) {
      setError('color', { type: 'manual', message: 'categories.color.invalid' satisfies TranslationKey });

      return;
    }

    onSubmit(isRoot ? { name: values.name.trim(), kind: values.kind, color: values.color.trim() } : { name: values.name.trim() });
  });

  const title = isRoot
    ? category
      ? t('categories.dialog.editRoot')
      : t('categories.dialog.newRoot')
    : category
      ? t('categories.dialog.editChild')
      : t('categories.dialog.newChild');

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-3.5">
          {!isRoot && parent && (
            <div className="grid gap-1.5">
              <Label>{t('categories.field.parent')}</Label>
              <span className="flex items-center gap-2">
                <span className="size-2.5 flex-none rounded-sm" style={{ background: parent.color ?? undefined }} />
                <span className="font-medium">{parent.name}</span>
              </span>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="category-name">{t('categories.field.name')}</Label>
            <Input
              id="category-name"
              placeholder={isRoot ? t('categories.field.namePlaceholder') : t('categories.field.childPlaceholder')}
              aria-invalid={errors.name !== undefined}
              aria-describedby={errors.name ? 'category-name-error' : undefined}
              disabled={isPending}
              {...register('name')}
            />
            {errors.name && (
              <span id="category-name-error" className="text-xs text-destructive">
                {t(errors.name.message as TranslationKey)}
              </span>
            )}
          </div>

          {isRoot && (
            <div className="grid gap-1.5">
              <Label>{t('categories.field.kind')}</Label>
              <Controller
                control={control}
                name="kind"
                render={({ field }) => (
                  <Tabs value={field.value} onValueChange={field.onChange}>
                    <TabsList>
                      <TabsTrigger value="EXPENSE" disabled={isPending}>
                        {t('categories.kind.EXPENSE')}
                      </TabsTrigger>
                      <TabsTrigger value="INCOME" disabled={isPending}>
                        {t('categories.kind.INCOME')}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              />
            </div>
          )}

          {isRoot ? (
            <Controller
              control={control}
              name="color"
              render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} invalid={errors.color !== undefined} />}
            />
          ) : (
            <p className="text-xs text-muted-foreground">{t('categories.hint.inheritsColor', { name: parent?.name ?? '' })}</p>
          )}

          {isRoot && !category && <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{t('categories.hint.automaticOthers')}</p>}

          {error !== undefined && error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {apiErrorMessage(error, t)}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2Icon className="animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
