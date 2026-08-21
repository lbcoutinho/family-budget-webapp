import { type CreateInstallmentPlanDto, useListAccounts } from '@family-budget/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { InfoIcon, Loader2Icon } from 'lucide-react';
import { useEffect, type FocusEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import { installmentOccurrenceDates } from './installment-occurrences';
import { splitInstallments } from './installment-split';
import { OccurrencePreview, type OccurrencePreviewRow } from './occurrence-preview';

import { FieldError } from '@/components/field-error';
import { HintTooltip } from '@/components/hint-tooltip';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { CategorySelect } from '@/features/transactions/category-select';
import { formKey } from '@/i18n';
import { apiErrorMessage } from '@/lib/api-error';
import { formatCents, parseCurrencyInput } from '@/lib/money';

interface InstallmentFormValues {
  accountId: string;
  categoryId: string;
  subcategoryId: string;
  purchaseDate: string;
  firstPaymentDate: string;
  count: string;
  description: string;
  total: string;
  autoConfirm: boolean;
}

const installmentSchema = z
  .object({
    accountId: z.string().min(1, 'recurrences.installmentForm.required'),
    categoryId: z.string(),
    subcategoryId: z.string(),
    purchaseDate: z.string().min(1, 'recurrences.installmentForm.required'),
    firstPaymentDate: z.string().min(1, 'recurrences.installmentForm.required'),
    count: z
      .string()
      .refine((value) => Number.isInteger(Number(value)) && Number(value) >= 2 && Number(value) <= 120, 'recurrences.installmentForm.invalidCount'),
    description: z.string().trim().min(1, 'recurrences.installmentForm.required').max(160),
    total: z.string().refine((value) => (parseCurrencyInput(value) ?? 0) > 0, 'recurrences.installmentForm.invalidAmount'),
    autoConfirm: z.boolean(),
  })
  .superRefine((values, context) => {
    if (values.categoryId.length === 0) {
      context.addIssue({ code: 'custom', path: ['categoryId'], message: 'recurrences.installmentForm.required' });
    } else if (values.subcategoryId.length === 0) {
      context.addIssue({ code: 'custom', path: ['subcategoryId'], message: 'recurrences.installmentForm.required' });
    }
  });

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Shared by `useForm`'s `defaultValues` and the reset-on-open effect — a blank form, purchase and
 * first-payment dates defaulted to today. */
function emptyValues(): InstallmentFormValues {
  return {
    accountId: '',
    categoryId: '',
    subcategoryId: '',
    purchaseDate: today(),
    firstPaymentDate: today(),
    count: '3',
    description: '',
    total: '',
    autoConfirm: true,
  };
}

export interface InstallmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  error: unknown;
  onSubmit: (values: CreateInstallmentPlanDto) => void;
}

/** Creation only — an installment plan is materialized in full up front (ADR-0014), so unlike a
 * fixed rule there is nothing to edit here later; `recurrence-list.tsx` offers only cancel. */
export function InstallmentDialog({ open, onOpenChange, isPending, error, onSubmit }: InstallmentDialogProps) {
  const { t } = useTranslation();
  const { data: accounts = [] } = useListAccounts();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<InstallmentFormValues>({
    resolver: zodResolver(installmentSchema),
    mode: 'onBlur',
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (!open) return;
    reset(emptyValues());
  }, [open, reset]);

  const [categoryId, subcategoryId, firstPaymentDate, count, description, total, autoConfirm] = useWatch({
    control,
    name: ['categoryId', 'subcategoryId', 'firstPaymentDate', 'count', 'description', 'total', 'autoConfirm'],
  });

  const installments = Math.min(120, Math.max(1, Number(count) || 1));
  const totalCents = parseCurrencyInput(total) ?? 0;
  const split = firstPaymentDate ? splitInstallments(totalCents, installments) : [];
  const dates = firstPaymentDate ? installmentOccurrenceDates(firstPaymentDate, installments) : [];
  const remainder = split.length > 0 ? split[split.length - 1]! - split[0]! : 0;

  const previewRows: OccurrencePreviewRow[] = dates.map((occurrence, index) => ({
    date: occurrence.date,
    amountCents: -(split[index] ?? 0),
    clamped: occurrence.clamped,
    amber: index === installments - 1 && remainder > 0,
  }));

  const submit = handleSubmit((values) => {
    onSubmit({
      totalAmount: parseCurrencyInput(values.total) ?? 0,
      installments: Number(values.count),
      firstPaymentDate: values.firstPaymentDate,
      purchaseDate: values.purchaseDate,
      description: values.description.trim(),
      accountId: values.accountId,
      categoryId: values.categoryId,
      subcategoryId: values.subcategoryId,
      autoConfirm: values.autoConfirm,
    });
  });

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent showCloseButton={!isPending} className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t(formKey('recurrences.installmentForm.createTitle'))}</DialogTitle>
        </DialogHeader>

        <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.78fr)]">
          <div className="grid gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid min-w-0 content-start gap-1.5">
                <Label htmlFor="installment-account">{t(formKey('recurrences.installmentForm.account'))}</Label>
                <NativeSelect id="installment-account" aria-invalid={errors.accountId !== undefined} disabled={isPending} {...register('accountId')}>
                  <option value="" />
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </NativeSelect>
                <FieldError error={errors.accountId?.message} />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="installment-purchase-date">{t(formKey('recurrences.installmentForm.purchaseDate'))}</Label>
                  <HintTooltip>{t(formKey('recurrences.installmentForm.purchaseDateHint'))}</HintTooltip>
                </div>
                <Input id="installment-purchase-date" type="date" disabled={isPending} {...register('purchaseDate')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="installment-count">{t(formKey('recurrences.installmentForm.count'))}</Label>
                <Input id="installment-count" type="number" min={2} max={120} disabled={isPending} {...register('count')} />
                <FieldError error={errors.count?.message} />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="installment-first-payment">{t(formKey('recurrences.installmentForm.firstPaymentDate'))}</Label>
                  <HintTooltip>{t(formKey('recurrences.installmentForm.firstPaymentDateHint'))}</HintTooltip>
                </div>
                <Input id="installment-first-payment" type="date" disabled={isPending} {...register('firstPaymentDate')} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <CategorySelect
                kind="EXPENSE"
                categoryId={categoryId || undefined}
                subcategoryId={subcategoryId || undefined}
                disabled={isPending}
                categoryError={errors.categoryId?.message}
                subcategoryError={errors.subcategoryId?.message}
                onChange={(nextCategory, nextSubcategory) => {
                  setValue('categoryId', nextCategory ?? '', { shouldValidate: true });
                  setValue('subcategoryId', nextSubcategory ?? '');
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="installment-description">{t(formKey('recurrences.installmentForm.description'))}</Label>
                <Input id="installment-description" disabled={isPending} {...register('description')} />
                <FieldError error={errors.description?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="installment-total">{t(formKey('recurrences.installmentForm.total'))}</Label>
                <Input
                  id="installment-total"
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  disabled={isPending}
                  {...register('total', {
                    onBlur: (event: FocusEvent<HTMLInputElement>) => {
                      const cents = parseCurrencyInput(event.target.value);
                      if (cents !== null) setValue('total', formatCents(cents), { shouldValidate: true });
                    },
                  })}
                />
                <FieldError error={errors.total?.message} />
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Switch
                checked={autoConfirm}
                onCheckedChange={(checked) => setValue('autoConfirm', checked)}
                disabled={isPending}
                aria-label={t(formKey('recurrences.installmentForm.autoConfirm'))}
              />
              <span className="text-sm">{t(formKey('recurrences.installmentForm.autoConfirm'))}</span>
              <HintTooltip>{t(formKey('recurrences.installmentForm.autoConfirmHint'))}</HintTooltip>
            </div>

            {error !== undefined && error !== null && (
              <p role="alert" className="text-sm text-destructive">
                {apiErrorMessage(error, t)}
              </p>
            )}
            <p className="flex items-start gap-2 rounded-md border-l-[3px] border-transfer bg-[#e8eff7] px-3 py-2.5 text-xs text-transfer">
              <InfoIcon aria-hidden className="mt-px size-[15px] shrink-0" />
              <span>{t(formKey('recurrences.installmentForm.notice'), { count: installments })}</span>
            </p>
          </div>

          <OccurrencePreview
            rows={previewRows}
            emptyMessage={t(formKey('recurrences.preview.empty'))}
            footerNote={remainder > 0 ? t(formKey('recurrences.preview.remainderNote'), { amount: formatCents(remainder) }) : description}
            footerTotal={previewRows.length > 0 ? formatCents(totalCents) : undefined}
          />

          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2Icon className="animate-spin" />}
              {t(formKey('recurrences.installmentForm.submit'), { count: installments })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
