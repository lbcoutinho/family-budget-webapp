import {
  type CreateRecurrenceRuleDto,
  type PreviewRecurrenceRulePayloadDto,
  type RecurrenceRuleDto,
  type UpdateRecurrenceRuleDto,
  useListAccounts,
  usePreviewRecurrenceRulePayload,
} from '@family-budget/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon } from 'lucide-react';
import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import { OccurrencePreview, type OccurrencePreviewRow } from './occurrence-preview';

import { FieldError } from '@/components/field-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CategorySelect } from '@/features/transactions/category-select';
import { formKey } from '@/i18n';
import { apiErrorMessage } from '@/lib/api-error';
import { formatCents, parseCurrencyInput } from '@/lib/money';

const DEBOUNCE_MS = 300;
const PREVIEW_MONTHS = 12;
const PREVIEW_ROWS = 6;

type RuleKind = 'EXPENSE' | 'INCOME';

interface RuleFormValues {
  type: RuleKind;
  accountId: string;
  categoryId: string;
  subcategoryId: string;
  frequency: 'MONTHLY' | 'YEARLY';
  dayOfMonth: string;
  description: string;
  amount: string;
  startMonth: string;
  endMonth: string;
  autoConfirm: boolean;
}

/** `autoConfirm` is a field the user can flip while the dialog is open, so its effect on `amount`
 * belongs in `superRefine` (evaluated against the live form values on every validation) rather than
 * baked into the schema at `useForm` construction time, which would freeze the very first value. */
const ruleSchema = z
  .object({
    type: z.enum(['EXPENSE', 'INCOME']),
    accountId: z.string().min(1, 'recurrences.ruleForm.required'),
    categoryId: z.string(),
    subcategoryId: z.string(),
    frequency: z.enum(['MONTHLY', 'YEARLY']),
    dayOfMonth: z.string().refine((value) => {
      const day = Number(value);
      return Number.isInteger(day) && day >= 1 && day <= 31;
    }, 'recurrences.ruleForm.invalidDayOfMonth'),
    description: z.string().trim().min(1, 'recurrences.ruleForm.required').max(200),
    amount: z.string(),
    startMonth: z.string().min(1, 'recurrences.ruleForm.required'),
    endMonth: z.string(),
    autoConfirm: z.boolean(),
  })
  .superRefine((values, context) => {
    if (values.categoryId.length === 0) {
      context.addIssue({ code: 'custom', path: ['categoryId'], message: 'recurrences.ruleForm.required' });
    } else if (values.subcategoryId.length === 0) {
      context.addIssue({ code: 'custom', path: ['subcategoryId'], message: 'recurrences.ruleForm.required' });
    }
    if (values.endMonth !== '' && values.endMonth < values.startMonth) {
      context.addIssue({ code: 'custom', path: ['endMonth'], message: 'recurrences.ruleForm.endBeforeStart' });
    }
    if (values.autoConfirm && (parseCurrencyInput(values.amount) ?? 0) <= 0) {
      context.addIssue({ code: 'custom', path: ['amount'], message: 'recurrences.ruleForm.invalidAmount' });
    }
  });

/** The rule's `startDate`/`endDate` only ever matter by month — the calendar day comes from
 * `dayOfMonth` — so the form collects `YYYY-MM` and this fills in the boundary day: the 1st for a
 * start, the month's last day for an end (so an occurrence anywhere in that month still counts). */
function monthToStartDate(month: string): string {
  return `${month}-01`;
}

function monthToEndDate(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year!, monthNumber!, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, '0')}`;
}

export interface RecurrenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `undefined` means create; a value means edit, and pre-fills the form. */
  rule?: RecurrenceRuleDto;
  isPending: boolean;
  error: unknown;
  onSubmit: (values: CreateRecurrenceRuleDto & UpdateRecurrenceRuleDto) => void;
}

export function RecurrenceDialog({ open, onOpenChange, rule, isPending, error, onSubmit }: RecurrenceDialogProps) {
  const { t } = useTranslation();
  const { data: accounts = [] } = useListAccounts(rule ? { includeInactive: true } : undefined);
  const previewSeq = useRef(0);
  const lastPreviewedKey = useRef<string>('');
  const [previewedKey, setPreviewedKey] = useState('');

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    // Save is disabled until the preview loads, so client-side errors need to surface on their own
    // — onBlur, rather than waiting for a submit that a disabled button will never let happen.
    mode: 'onBlur',
    defaultValues: {
      type: 'EXPENSE',
      accountId: '',
      categoryId: '',
      subcategoryId: '',
      frequency: 'MONTHLY',
      dayOfMonth: '1',
      description: '',
      amount: '',
      startMonth: '',
      endMonth: '',
      autoConfirm: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      type: rule?.type ?? 'EXPENSE',
      accountId: rule?.accountId ?? '',
      categoryId: rule?.categoryId ?? '',
      subcategoryId: rule?.subcategoryId ?? '',
      frequency: rule?.frequency ?? 'MONTHLY',
      dayOfMonth: String(rule?.dayOfMonth ?? 1),
      description: rule?.description ?? '',
      amount: rule?.amount !== null && rule?.amount !== undefined ? formatCents(rule.amount) : '',
      startMonth: rule?.startDate.slice(0, 7) ?? '',
      endMonth: rule?.endDate?.slice(0, 7) ?? '',
      autoConfirm: rule?.autoConfirm ?? true,
    });
    lastPreviewedKey.current = '';
    // Deferred like `entry-dialog.tsx`'s own reset-on-open effect: a `setState` synchronous with
    // the effect body trips `react-hooks/set-state-in-effect` even though this only reruns when
    // `open`/`rule` change, not on every render.
    queueMicrotask(() => setPreviewedKey(''));
  }, [open, rule, reset]);

  const [type, categoryId, subcategoryId, frequency, dayOfMonth, startMonth, endMonth, autoConfirm] = useWatch({
    control,
    name: ['type', 'categoryId', 'subcategoryId', 'frequency', 'dayOfMonth', 'startMonth', 'endMonth', 'autoConfirm'],
  });

  const previewPayload = usePreviewRecurrenceRulePayload();

  const payloadKey = JSON.stringify({ frequency, dayOfMonth, startMonth, endMonth });

  useEffect(() => {
    if (!open) return;
    const day = Number(dayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 31 || !startMonth) return;

    const timeout = window.setTimeout(() => {
      const payload: PreviewRecurrenceRulePayloadDto = {
        frequency,
        dayOfMonth: day,
        startDate: monthToStartDate(startMonth),
        endDate: endMonth ? monthToEndDate(endMonth) : null,
        months: PREVIEW_MONTHS,
      };
      const seq = ++previewSeq.current;
      previewPayload.mutate(
        { data: payload },
        {
          onSuccess: () => {
            if (seq === previewSeq.current) {
              lastPreviewedKey.current = payloadKey;
              setPreviewedKey(payloadKey);
            }
          },
        },
      );
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- payloadKey is derived from the same fields already listed; previewPayload's identity is stable across renders.
  }, [open, frequency, dayOfMonth, startMonth, endMonth]);

  const amount = useWatch({ control, name: 'amount' });
  const amountCents = parseCurrencyInput(amount) ?? 0;
  const previewReady = previewedKey === payloadKey && previewPayload.isSuccess;
  const previewRows: OccurrencePreviewRow[] = previewReady
    ? (previewPayload.data?.occurrences ?? []).slice(0, PREVIEW_ROWS).map((date) => {
        const [year, month, day] = date.split('-').map(Number);
        const parsedDay = Number(dayOfMonth);
        return {
          date: new Date(year!, month! - 1, day),
          amountCents: type === 'INCOME' ? amountCents : -amountCents,
          clamped: day !== parsedDay,
          note: day !== parsedDay ? t(formKey('recurrences.ruleForm.invalidDayOfMonth')) : undefined,
        };
      })
    : [];
  const clampedCount = previewRows.filter((row) => row.clamped).length;

  const submit = handleSubmit((values) => {
    const amountValue = parseCurrencyInput(values.amount);
    onSubmit({
      type: values.type,
      amount: values.autoConfirm ? (amountValue ?? 0) : amountValue,
      description: values.description.trim(),
      accountId: values.accountId,
      categoryId: values.categoryId,
      subcategoryId: values.subcategoryId,
      frequency: values.frequency,
      dayOfMonth: Number(values.dayOfMonth),
      startDate: monthToStartDate(values.startMonth),
      endDate: values.endMonth ? monthToEndDate(values.endMonth) : null,
      autoConfirm: values.autoConfirm,
    });
  });

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent showCloseButton={!isPending} className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t(formKey(rule ? 'recurrences.ruleForm.editTitle' : 'recurrences.ruleForm.createTitle'))}</DialogTitle>
        </DialogHeader>

        <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-3.5">
            <Tabs
              value={type}
              onValueChange={(value) => {
                setValue('type', value as RuleKind, { shouldValidate: true });
                // The category picker filters its roots by kind (`CategorySelect`), so a category
                // chosen under the old kind would otherwise submit as a mismatched, invisible
                // selection under the new one.
                setValue('categoryId', '');
                setValue('subcategoryId', '');
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="EXPENSE">{t(formKey('recurrences.ruleForm.expense'))}</TabsTrigger>
                <TabsTrigger value="INCOME">{t(formKey('recurrences.ruleForm.income'))}</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid min-w-0 content-start gap-1.5">
                <Label htmlFor="rule-account">{t(formKey('recurrences.ruleForm.account'))}</Label>
                <NativeSelect id="rule-account" aria-invalid={errors.accountId !== undefined} disabled={isPending} {...register('accountId')}>
                  <option value="">{t(formKey('recurrences.ruleForm.accountPlaceholder'))}</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id} disabled={!account.isActive && account.id !== rule?.accountId}>
                      {account.name}
                    </option>
                  ))}
                </NativeSelect>
                <FieldError error={errors.accountId?.message} />
              </div>
              <div className="grid min-w-0 content-start gap-1.5">
                <Label htmlFor="rule-frequency">{t(formKey('recurrences.ruleForm.frequencyLabel'))}</Label>
                <NativeSelect id="rule-frequency" disabled={isPending} {...register('frequency')}>
                  <option value="MONTHLY">{t(formKey('recurrences.ruleForm.frequencyMonthly'))}</option>
                  <option value="YEARLY">{t(formKey('recurrences.ruleForm.frequencyYearly'))}</option>
                </NativeSelect>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="rule-day">{t(formKey('recurrences.ruleForm.dayOfMonth'))}</Label>
              <Input id="rule-day" type="number" min={1} max={31} className="w-24" disabled={isPending} {...register('dayOfMonth')} />
              <FieldError error={errors.dayOfMonth?.message} />
            </div>

            <CategorySelect
              kind={type}
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

            <div className="grid gap-1.5">
              <Label htmlFor="rule-description">{t(formKey('recurrences.ruleForm.description'))}</Label>
              <Input id="rule-description" disabled={isPending} {...register('description')} />
              <FieldError error={errors.description?.message} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="rule-amount">{t(formKey('recurrences.ruleForm.amount'))}</Label>
              <Input
                id="rule-amount"
                inputMode="decimal"
                className="text-right tabular-nums"
                placeholder={t(formKey('recurrences.ruleForm.amountPlaceholder'))}
                disabled={isPending}
                {...register('amount', {
                  onBlur: (event: FocusEvent<HTMLInputElement>) => {
                    const cents = parseCurrencyInput(event.target.value);
                    if (cents !== null) setValue('amount', formatCents(cents), { shouldValidate: true });
                  },
                })}
              />
              {!autoConfirm ? <p className="text-xs text-muted-foreground">{t(formKey('recurrences.ruleForm.amountHintVariable'))}</p> : null}
              <FieldError error={errors.amount?.message} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="rule-start">{t(formKey('recurrences.ruleForm.start'))}</Label>
                <Input id="rule-start" type="month" disabled={isPending} {...register('startMonth')} />
                <FieldError error={errors.startMonth?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rule-end">{t(formKey('recurrences.ruleForm.end'))}</Label>
                <Input id="rule-end" type="month" disabled={isPending} {...register('endMonth')} />
                <FieldError error={errors.endMonth?.message} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t(formKey('recurrences.ruleForm.endHint'))}</p>

            <label className="flex items-center gap-2.5">
              <Switch
                checked={autoConfirm}
                onCheckedChange={(checked) => setValue('autoConfirm', checked)}
                disabled={isPending}
                aria-label={t(formKey('recurrences.ruleForm.autoConfirm'))}
              />
              <span className="text-sm">{t(formKey('recurrences.ruleForm.autoConfirm'))}</span>
            </label>
            <p className="text-xs text-muted-foreground">{t(formKey('recurrences.ruleForm.autoConfirmHint'))}</p>

            <p className="rounded-md bg-muted/70 p-2.5 text-xs text-muted-foreground">{t(formKey('recurrences.ruleForm.editNotice'))}</p>

            {error !== undefined && error !== null && (
              <p role="alert" className="text-sm text-destructive">
                {apiErrorMessage(error, t)}
              </p>
            )}
          </div>

          <OccurrencePreview
            rows={previewRows}
            loading={!previewReady && previewPayload.isPending}
            error={previewPayload.isError ? apiErrorMessage(previewPayload.error, t) : undefined}
            emptyMessage={t(formKey('recurrences.preview.empty'))}
            footerNote={
              clampedCount > 0
                ? t(formKey('recurrences.preview.clamped'), { count: clampedCount, total: previewRows.length })
                : t(formKey('recurrences.preview.occurrences'), { count: previewRows.length })
            }
            footerTotal={
              previewRows.length > 0 ? t(formKey('recurrences.preview.total'), { amount: formatCents(amountCents * previewRows.length) }) : undefined
            }
          />

          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !previewReady}>
              {isPending && <Loader2Icon className="animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
