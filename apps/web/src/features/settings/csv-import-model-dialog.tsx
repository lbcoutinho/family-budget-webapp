import { type CreateCsvImportModelDto } from '@family-budget/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { type TranslationKey } from '@/i18n';
import { apiErrorMessage } from '@/lib/api-error';

const csvImportModelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'settingsGeneral.models.form.nameRequired' satisfies TranslationKey)
    .max(100, 'settingsGeneral.models.form.nameTooLong' satisfies TranslationKey),
  headerLineCount: z.coerce
    .number()
    .int('settingsGeneral.models.form.headerLinesRange' satisfies TranslationKey)
    .min(1, 'settingsGeneral.models.form.headerLinesRange' satisfies TranslationKey)
    .max(100, 'settingsGeneral.models.form.headerLinesRange' satisfies TranslationKey),
  separator: z.enum([',', ';', '\t']),
  dateHeader: z
    .string()
    .trim()
    .min(1, 'settingsGeneral.models.form.headerRequired' satisfies TranslationKey),
  descriptionHeader: z
    .string()
    .trim()
    .min(1, 'settingsGeneral.models.form.headerRequired' satisfies TranslationKey),
  amountHeader: z
    .string()
    .trim()
    .min(1, 'settingsGeneral.models.form.headerRequired' satisfies TranslationKey),
});

type CsvImportModelFormValues = z.infer<typeof csvImportModelSchema>;
type CsvImportModelFormInput = z.input<typeof csvImportModelSchema>;

export function CsvImportModelDialog({
  open,
  onOpenChange,
  isPending,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  error: unknown;
  onSubmit: (values: CreateCsvImportModelDto) => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CsvImportModelFormInput, unknown, CsvImportModelFormValues>({
    resolver: zodResolver(csvImportModelSchema),
    defaultValues: { name: '', headerLineCount: 1, separator: ';', dateHeader: 'Data', descriptionHeader: 'Histórico', amountHeader: 'Valor' },
  });

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const fieldError = (name: keyof CsvImportModelFormValues) => errors[name]?.message as TranslationKey | undefined;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[620px]" showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>{t('settingsGeneral.models.form.title')}</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(event) =>
            void handleSubmit((values) =>
              onSubmit({
                ...values,
                name: values.name.trim(),
                dateHeader: values.dateHeader.trim(),
                descriptionHeader: values.descriptionHeader.trim(),
                amountHeader: values.amountHeader.trim(),
              }),
            )(event)
          }
          className="grid gap-3.5"
        >
          <Field htmlFor="csv-model-name" label={t('settingsGeneral.models.form.name')} error={fieldError('name')}>
            <Input id="csv-model-name" aria-invalid={errors.name !== undefined} disabled={isPending} {...register('name')} />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field htmlFor="csv-model-header-lines" label={t('settingsGeneral.models.form.headerLines')} error={fieldError('headerLineCount')}>
              <Input
                id="csv-model-header-lines"
                type="number"
                min={1}
                max={100}
                aria-invalid={errors.headerLineCount !== undefined}
                disabled={isPending}
                {...register('headerLineCount', { valueAsNumber: true })}
              />
            </Field>
            <div className="grid gap-1.5">
              <Label htmlFor="csv-model-separator">{t('settingsGeneral.models.form.separator')}</Label>
              <NativeSelect id="csv-model-separator" disabled={isPending} {...register('separator')}>
                <option value=";">{t('settingsGeneral.models.separators.semicolon')}</option>
                <option value=",">{t('settingsGeneral.models.separators.comma')}</option>
                <option value="\t">{t('settingsGeneral.models.separators.tab')}</option>
              </NativeSelect>
            </div>
            <Field htmlFor="csv-model-date-header" label={t('settingsGeneral.models.form.dateHeader')} error={fieldError('dateHeader')}>
              <Input id="csv-model-date-header" aria-invalid={errors.dateHeader !== undefined} disabled={isPending} {...register('dateHeader')} />
            </Field>
            <Field htmlFor="csv-model-description-header" label={t('settingsGeneral.models.form.descriptionHeader')} error={fieldError('descriptionHeader')}>
              <Input
                id="csv-model-description-header"
                aria-invalid={errors.descriptionHeader !== undefined}
                disabled={isPending}
                {...register('descriptionHeader')}
              />
            </Field>
            <Field
              htmlFor="csv-model-amount-header"
              className="sm:col-span-2"
              label={t('settingsGeneral.models.form.amountHeader')}
              error={fieldError('amountHeader')}
            >
              <Input id="csv-model-amount-header" aria-invalid={errors.amountHeader !== undefined} disabled={isPending} {...register('amountHeader')} />
            </Field>
          </div>
          <p className="rounded-md border border-primary/20 bg-primary/10 p-3 text-sm text-foreground">{t('settingsGeneral.models.form.hint')}</p>
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
              {t('settingsGeneral.models.form.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  htmlFor,
  label,
  error,
  className,
  children,
}: {
  htmlFor: string;
  label: string;
  error?: TranslationKey;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className={`grid gap-1.5 ${className ?? ''}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{t(error)}</p>}
    </div>
  );
}
