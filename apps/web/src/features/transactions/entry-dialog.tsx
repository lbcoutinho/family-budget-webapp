import {
  getGetMonthlyBalanceQueryKey,
  getListAccountBalancesQueryKey,
  getListTransactionsQueryKey,
  type CreateTransactionDto,
  type UpdateTransactionDto,
  type TransactionListDto,
  type TransactionListItemDto,
  TransactionStatus,
  useCreateTransaction,
  useListAccounts,
  useUpdateTransaction,
} from '@family-budget/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';
import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import * as z from 'zod';

import { CategorySelect } from './category-select';
import { getDailyExpensesQueryKey } from './daily-expense-strip';

import { FieldError } from '@/components/field-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formKey } from '@/i18n';
import { apiErrorMessage } from '@/lib/api-error';
import { formatCents, parseCurrencyInput } from '@/lib/money';

type EntryType = 'EXPENSE' | 'INCOME' | 'TRANSFER';

interface EntryFormValues {
  type: EntryType;
  date: string;
  accountId: string;
  destinationAccountId: string;
  categoryId: string;
  subcategoryId: string;
  description: string;
  notes: string;
  amount: string;
  isCreditCard: boolean;
  referenceMonth: string;
}

/**
 * `allowEmptyAmount` is only true while editing a DRAFT (ADR-0020): a variable-amount rule
 * materializes with no amount, and the field stays legitimately blank until the bill arrives. A
 * new entry (always created CONFIRMED — there is no client path to a DRAFT yet) and an edit of an
 * already-CONFIRMED transaction both keep requiring a positive amount.
 */
function buildEntrySchema(allowEmptyAmount: boolean) {
  return z
    .object({
      type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']),
      date: z.string().min(1, 'transactions.form.required'),
      accountId: z.string().min(1, 'transactions.form.required'),
      destinationAccountId: z.string(),
      categoryId: z.string(),
      subcategoryId: z.string(),
      description: z.string().trim().min(1, 'transactions.form.required').max(200),
      notes: z.string().trim().max(1000, 'transactions.form.notesTooLong'),
      amount: z
        .string()
        .refine((value) => (allowEmptyAmount && value.trim() === '') || (parseCurrencyInput(value) ?? 0) > 0, 'transactions.form.invalidAmount'),
      isCreditCard: z.boolean(),
      referenceMonth: z.string().min(1, 'transactions.form.required'),
    })
    .superRefine((values, context) => {
      if (values.type === 'TRANSFER') {
        if (values.destinationAccountId.length === 0)
          context.addIssue({ code: 'custom', path: ['destinationAccountId'], message: 'transactions.form.required' });
        if (values.accountId === values.destinationAccountId && values.accountId.length > 0) {
          context.addIssue({ code: 'custom', path: ['destinationAccountId'], message: 'transactions.form.sameAccount' });
        }
        return;
      }

      if (values.categoryId.length === 0) {
        context.addIssue({ code: 'custom', path: ['categoryId'], message: 'transactions.form.required' });
      } else if (values.subcategoryId.length === 0) {
        context.addIssue({ code: 'custom', path: ['subcategoryId'], message: 'transactions.form.required' });
      }
    });
}

const BUSINESS_CODE_FIELD: Record<string, keyof EntryFormValues | undefined> = {
  TRANSACTION_SAME_ACCOUNT: 'destinationAccountId',
  TRANSACTION_CATEGORY_KIND_MISMATCH: 'categoryId',
  TRANSACTION_SUBCATEGORY_PARENT_MISMATCH: 'subcategoryId',
};

/** The field errors are deliberately limited to codes that name one unambiguous input. */
export function businessCodeField(code: string | undefined): keyof EntryFormValues | undefined {
  return code === undefined ? undefined : BUSINESS_CODE_FIELD[code];
}

/** Visual top-to-bottom order per tab, walked to focus the first errored field on a failed submit. */
const FOCUS_ORDER: Record<EntryType, readonly (keyof EntryFormValues)[]> = {
  EXPENSE: ['accountId', 'date', 'categoryId', 'subcategoryId', 'description', 'notes', 'amount', 'referenceMonth'],
  INCOME: ['accountId', 'date', 'categoryId', 'subcategoryId', 'description', 'notes', 'amount', 'referenceMonth'],
  TRANSFER: ['accountId', 'destinationAccountId', 'date', 'description', 'notes', 'amount'],
};

/** Native month input emits YYYY-MM; the API requires its first day. */
export function suggestedReferenceMonth(date: string): string {
  const [year, month] = date.split('-').map(Number);
  if (!year || !month) return '';
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function referenceMonthFromDate(date: string): string {
  return date ? `${date.slice(0, 7)}-01` : '';
}

export interface EntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TransactionListItemDto;
}

export function EntryDialog({ open, onOpenChange, transaction }: EntryDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const saveAnother = useRef(false);
  const categoryRef = useRef<HTMLButtonElement>(null);
  const subcategoryRef = useRef<HTMLButtonElement>(null);
  const [referenceMonthOverridden, setReferenceMonthOverridden] = useState(Boolean(transaction));
  const { data: accounts = [] } = useListAccounts(transaction ? { includeInactive: true } : undefined);
  const {
    control,
    register,
    handleSubmit,
    getValues,
    reset,
    setError,
    setFocus,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(buildEntrySchema(transaction?.status === TransactionStatus.DRAFT)),
    shouldFocusError: false,
    defaultValues: {
      type: (transaction?.type as EntryType | undefined) ?? 'EXPENSE',
      date: transaction?.date ?? today(),
      accountId: transaction?.accountId ?? '',
      destinationAccountId: transaction?.destinationAccountId ?? '',
      categoryId: transaction?.categoryId ?? '',
      subcategoryId: transaction?.subcategoryId ?? '',
      description: transaction?.description ?? '',
      notes: transaction?.notes ?? '',
      amount: transaction?.amount !== null && transaction?.amount !== undefined ? formatCents(transaction.amount) : '',
      isCreditCard: transaction?.isCreditCard ?? false,
      referenceMonth: transaction?.referenceMonth?.slice(0, 7) ?? referenceMonthFromDate(today()).slice(0, 7),
    },
  });
  const [type, date, isCreditCard, selectedCategoryId, selectedSubcategoryId, selectedAccountId, selectedDestinationAccountId] = useWatch({
    control,
    name: ['type', 'date', 'isCreditCard', 'categoryId', 'subcategoryId', 'accountId', 'destinationAccountId'],
  });
  const categoryId = selectedCategoryId || undefined;
  const subcategoryId = selectedSubcategoryId || undefined;

  /** categoryId/subcategoryId are Radix triggers with no registered input ref, so neither RHF's
   * shouldFocusError nor setFocus can reach them — this is the shared escape hatch for both. */
  const focusCategoryOrSubcategory = (field: 'categoryId' | 'subcategoryId') => {
    if (field === 'categoryId') categoryRef.current?.focus();
    else subcategoryRef.current?.focus();
  };

  const mutation = useCreateTransaction({
    mutation: {
      onMutate: async ({ data }) => {
        const resolvedReferenceMonth = data.referenceMonth ?? referenceMonthFromDate(data.date);
        const key = getListTransactionsQueryKey({ referenceMonth: resolvedReferenceMonth, limit: 30 });
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData<InfiniteData<TransactionListDto>>(key);

        if (previous) {
          const optimistic: TransactionListItemDto = {
            id: `optimistic-${crypto.randomUUID()}`,
            type: data.type,
            status: TransactionStatus.CONFIRMED,
            source: 'MANUAL',
            amount: data.amount,
            date: data.date,
            referenceMonth: resolvedReferenceMonth,
            description: data.description,
            notes: data.notes ?? null,
            isCreditCard: data.isCreditCard ?? false,
            accountId: data.accountId ?? null,
            destinationAccountId: data.destinationAccountId ?? null,
            categoryId: data.categoryId ?? null,
            subcategoryId: data.subcategoryId ?? null,
            cashboxId: null,
            destinationCashboxId: null,
            cashboxLabel: null,
            destinationCashboxLabel: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            recurrenceRuleId: null,
            installmentNumber: null,
            installmentTotal: null,
            account: accounts.find((account) => account.id === data.accountId) ?? null,
            category: null,
            subcategory: null,
          };
          // ponytail: mirrors Issue 152's first-page shape; use plain invalidation if that cache changes.
          queryClient.setQueryData<InfiniteData<TransactionListDto>>(key, {
            ...previous,
            pages: previous.pages.map((page, index) =>
              index === 0
                ? {
                    ...page,
                    items: [optimistic, ...page.items],
                    total: page.total + 1,
                    incomeTotal: page.incomeTotal + (data.type === 'INCOME' ? data.amount : 0),
                    expenseTotal: page.expenseTotal + (data.type === 'EXPENSE' ? data.amount : 0),
                  }
                : page,
            ),
          });
        }
        return { key, previous };
      },
      onError: (error, _variables, context) => {
        if (context?.previous) queryClient.setQueryData(context.key, context.previous);
        const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
        const field = businessCodeField(code);
        if (field) {
          setError(field, { message: formKey(`errors.${code}`) }, { shouldFocus: true });
          if (field === 'categoryId' || field === 'subcategoryId') focusCategoryOrSubcategory(field);
        } else {
          toast.error(apiErrorMessage(error, t));
        }
      },
      onSuccess: () => {
        if (saveAnother.current) {
          reset({
            type: getValues('type'),
            date: today(),
            accountId: '',
            destinationAccountId: '',
            categoryId: '',
            subcategoryId: '',
            description: '',
            notes: '',
            amount: '',
            isCreditCard: false,
            referenceMonth: '',
          });
          setReferenceMonthOverridden(false);
          toast.success(t(formKey('transactions.form.save')));
          setTimeout(() => setFocus('accountId'));
        } else {
          onOpenChange(false);
        }
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getListAccountBalancesQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetMonthlyBalanceQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getDailyExpensesQueryKey() });
      },
    },
  });

  const updateMutation = useUpdateTransaction({
    mutation: {
      onError: (error) => toast.error(apiErrorMessage(error, t)),
      onSuccess: () => {
        toast.success(t(formKey('transactions.form.save')));
        onOpenChange(false);
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getListAccountBalancesQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetMonthlyBalanceQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getDailyExpensesQueryKey() });
      },
    },
  });

  const activeMutation = transaction ? updateMutation : mutation;

  useEffect(() => {
    if (!open) return;
    const nextDate = today();
    reset({
      type: (transaction?.type as EntryType | undefined) ?? 'EXPENSE',
      date: transaction?.date ?? nextDate,
      accountId: transaction?.accountId ?? '',
      destinationAccountId: transaction?.destinationAccountId ?? '',
      categoryId: transaction?.categoryId ?? '',
      subcategoryId: transaction?.subcategoryId ?? '',
      description: transaction?.description ?? '',
      notes: transaction?.notes ?? '',
      amount: transaction?.amount !== null && transaction?.amount !== undefined ? formatCents(transaction.amount) : '',
      isCreditCard: transaction?.isCreditCard ?? false,
      referenceMonth: transaction?.referenceMonth?.slice(0, 7) ?? referenceMonthFromDate(nextDate).slice(0, 7),
    });
    queueMicrotask(() => setReferenceMonthOverridden(Boolean(transaction)));
  }, [open, reset, transaction]);

  useEffect(() => {
    if (!referenceMonthOverridden) {
      setValue('referenceMonth', (type === 'EXPENSE' && isCreditCard ? suggestedReferenceMonth(date) : referenceMonthFromDate(date)).slice(0, 7), {
        shouldValidate: true,
      });
    }
  }, [date, isCreditCard, referenceMonthOverridden, setValue, type]);

  const changeType = (nextType: string) => {
    setValue('type', nextType as EntryType, { shouldValidate: true });
    setValue('categoryId', '');
    setValue('subcategoryId', '');
    setValue('isCreditCard', false);
    setValue('referenceMonth', referenceMonthFromDate(date).slice(0, 7));
    setReferenceMonthOverridden(false);
    clearErrors();
  };

  const overrideReferenceMonth = () => {
    setReferenceMonthOverridden(true);
  };

  const submit = handleSubmit(
    (values) => {
      const isDraftEdit = transaction?.status === TransactionStatus.DRAFT;
      const amount = parseCurrencyInput(values.amount);
      // A blank amount is only legal while editing a DRAFT (ADR-0020) — `buildEntrySchema` already
      // enforced that on the field itself; this guard covers a new entry (always CONFIRMED) and an
      // edit of an already-CONFIRMED transaction, neither of which the schema left an opening for.
      if (!isDraftEdit && (amount === null || amount <= 0)) return;

      const shared = {
        type: values.type,
        date: values.date,
        referenceMonth: `${values.referenceMonth}-01`,
        description: values.description.trim(),
        notes: values.notes.trim() || null,
        isCreditCard: values.type === 'EXPENSE' ? values.isCreditCard : false,
        accountId: values.accountId,
        ...(values.type === 'TRANSFER'
          ? { destinationAccountId: values.destinationAccountId }
          : {
              categoryId: values.categoryId,
              subcategoryId: values.subcategoryId,
            }),
      };

      if (!transaction) {
        // `amount` is guaranteed non-null here: `isDraftEdit` is false for a new entry, so the guard
        // above already returned on a blank or non-positive field.
        const payload: CreateTransactionDto = { ...shared, amount: amount! };
        mutation.mutate({ data: payload });
        return;
      }

      const update: UpdateTransactionDto = {};
      const changed = <K extends keyof UpdateTransactionDto>(key: K, value: UpdateTransactionDto[K], original: UpdateTransactionDto[K]) => {
        if (value !== original) update[key] = value;
      };
      changed('amount', amount, transaction.amount);
      changed('date', shared.date, transaction.date);
      changed('description', shared.description, transaction.description);
      changed('notes', shared.notes, transaction.notes);
      changed('isCreditCard', shared.isCreditCard, transaction.isCreditCard);
      changed('accountId', shared.accountId, transaction.accountId ?? undefined);
      changed(
        'destinationAccountId',
        'destinationAccountId' in shared ? shared.destinationAccountId : undefined,
        transaction.destinationAccountId ?? undefined,
      );
      changed('categoryId', 'categoryId' in shared ? shared.categoryId : undefined, transaction.categoryId ?? undefined);
      changed('subcategoryId', 'subcategoryId' in shared ? shared.subcategoryId : undefined, transaction.subcategoryId ?? undefined);
      if (shared.date !== transaction.date || `${values.referenceMonth}-01` !== transaction.referenceMonth)
        update.referenceMonth = `${values.referenceMonth}-01`;
      updateMutation.mutate({ id: transaction.id, data: update });
    },
    // eslint-disable-next-line react-hooks/refs -- focusCategoryOrSubcategory only ever runs from the submit event, never during render.
    (formErrors) => {
      for (const field of FOCUS_ORDER[getValues('type')]) {
        if (!formErrors[field]) continue;
        if (field === 'categoryId' || field === 'subcategoryId') {
          focusCategoryOrSubcategory(field);
        } else {
          setFocus(field);
        }
        return;
      }
    },
  );

  const accountsEmpty = accounts.length === 0;
  return (
    <Dialog open={open} onOpenChange={activeMutation.isPending ? undefined : onOpenChange}>
      <DialogContent
        showCloseButton={!activeMutation.isPending}
        onEscapeKeyDown={activeMutation.isPending ? (event) => event.preventDefault() : undefined}
        onPointerDownOutside={activeMutation.isPending ? (event) => event.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle>{t(formKey(transaction ? 'transactions.form.editTitle' : 'transactions.form.title'))}</DialogTitle>
        </DialogHeader>
        {accountsEmpty ? (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">{t(formKey('transactions.form.noAccounts'))}</p>
            <Button asChild size="sm" className="w-fit">
              <Link to="/accounts">{t(formKey('transactions.form.createAccount'))}</Link>
            </Button>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={(event) => {
              saveAnother.current = event.nativeEvent.submitter?.getAttribute('data-save-another') === 'true';
              void submit(event);
            }}
            className="grid gap-3.5"
          >
            <Tabs value={type} onValueChange={changeType}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="EXPENSE" disabled={Boolean(transaction)}>
                  {t(formKey('transactions.form.expense'))}
                </TabsTrigger>
                <TabsTrigger value="INCOME" disabled={Boolean(transaction)}>
                  {t(formKey('transactions.form.income'))}
                </TabsTrigger>
                <TabsTrigger value="TRANSFER" disabled={Boolean(transaction)}>
                  {t(formKey('transactions.form.transfer'))}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="grid gap-3 sm:grid-cols-2">
              <AccountField
                id="entry-account"
                label={t(formKey(type === 'TRANSFER' ? 'transactions.form.sourceAccount' : 'transactions.form.account'))}
                accounts={accounts}
                selectedId={selectedAccountId}
                disabled={activeMutation.isPending}
                error={errors.accountId?.message}
                registration={register('accountId')}
              />
              {type === 'TRANSFER' ? (
                <AccountField
                  id="entry-destination-account"
                  label={t(formKey('transactions.form.destinationAccount'))}
                  accounts={accounts}
                  selectedId={selectedDestinationAccountId}
                  disabled={activeMutation.isPending}
                  error={errors.destinationAccountId?.message}
                  registration={register('destinationAccountId')}
                />
              ) : (
                <div className="grid min-w-0 content-start gap-1.5">
                  <Label htmlFor="entry-date">{t(formKey('transactions.form.date'))}</Label>
                  <Input
                    id="entry-date"
                    type="date"
                    aria-describedby={errors.date ? 'entry-date-error' : undefined}
                    aria-invalid={errors.date !== undefined}
                    disabled={activeMutation.isPending}
                    {...register('date')}
                  />
                  <FieldError id="entry-date-error" error={errors.date?.message} />
                </div>
              )}
            </div>
            {type === 'TRANSFER' ? (
              <div className="grid gap-1.5">
                <Label htmlFor="entry-date">{t(formKey('transactions.form.date'))}</Label>
                <Input
                  id="entry-date"
                  type="date"
                  aria-describedby={errors.date ? 'entry-date-error' : undefined}
                  aria-invalid={errors.date !== undefined}
                  disabled={activeMutation.isPending}
                  {...register('date')}
                />
                <FieldError id="entry-date-error" error={errors.date?.message} />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <CategorySelect
                  kind={type}
                  categoryId={categoryId}
                  subcategoryId={subcategoryId}
                  disabled={activeMutation.isPending}
                  categoryError={errors.categoryId?.message}
                  subcategoryError={errors.subcategoryId?.message}
                  categoryRef={categoryRef}
                  subcategoryRef={subcategoryRef}
                  onChange={(nextCategory, nextSubcategory) => {
                    setValue('categoryId', nextCategory ?? '', { shouldValidate: true });
                    setValue('subcategoryId', nextSubcategory ?? '');
                    clearErrors(['categoryId', 'subcategoryId']);
                  }}
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="entry-description">{t(formKey('transactions.form.description'))}</Label>
              <Input
                id="entry-description"
                aria-describedby={errors.description ? 'entry-description-error' : undefined}
                aria-invalid={errors.description !== undefined}
                disabled={activeMutation.isPending}
                {...register('description')}
              />
              <FieldError id="entry-description-error" error={errors.description?.message} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="entry-notes">{t(formKey('transactions.form.notes'))}</Label>
                <Input
                  id="entry-notes"
                  aria-describedby={errors.notes ? 'entry-notes-error' : undefined}
                  aria-invalid={errors.notes !== undefined}
                  disabled={activeMutation.isPending}
                  {...register('notes')}
                />
                <FieldError id="entry-notes-error" error={errors.notes?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="entry-amount">{t(formKey('transactions.form.amount'))}</Label>
                <Input
                  id="entry-amount"
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  placeholder={t(formKey('transactions.form.amountPlaceholder'))}
                  aria-describedby={errors.amount ? 'entry-amount-error' : undefined}
                  aria-invalid={errors.amount !== undefined}
                  disabled={activeMutation.isPending}
                  {...register('amount', {
                    onBlur: (event: FocusEvent<HTMLInputElement>) => {
                      const cents = parseCurrencyInput(event.target.value);
                      if (cents !== null) setValue('amount', formatCents(cents), { shouldValidate: true });
                    },
                  })}
                />
                <FieldError id="entry-amount-error" error={errors.amount?.message} />
              </div>
            </div>
            {type === 'EXPENSE' ? (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="entry-credit-card"
                    checked={isCreditCard}
                    disabled={activeMutation.isPending}
                    onCheckedChange={(checked) => {
                      const next = checked === true;
                      setValue('isCreditCard', next, { shouldValidate: true });
                      setValue('referenceMonth', (next ? suggestedReferenceMonth(date) : referenceMonthFromDate(date)).slice(0, 7));
                      setReferenceMonthOverridden(false);
                    }}
                  />
                  <Label htmlFor="entry-credit-card">{t(formKey('transactions.form.creditCard'))}</Label>
                </div>
              </>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="entry-reference-month">{t(formKey('transactions.form.referenceMonth'))}</Label>
              <Input
                id="entry-reference-month"
                type="month"
                aria-describedby={`entry-reference-month-hint${errors.referenceMonth ? ' entry-reference-month-error' : ''}`}
                aria-invalid={errors.referenceMonth !== undefined}
                disabled={activeMutation.isPending}
                {...register('referenceMonth', { onChange: overrideReferenceMonth })}
              />
              <p id="entry-reference-month-hint" className="text-xs text-muted-foreground">
                {t(formKey('transactions.form.referenceMonthHint'))}
              </p>
              <FieldError id="entry-reference-month-error" error={errors.referenceMonth?.message} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={activeMutation.isPending}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={activeMutation.isPending}>
                {activeMutation.isPending ? <Loader2Icon className="animate-spin" /> : null}
                {t(formKey('transactions.form.save'))}
              </Button>
              {!transaction ? (
                <Button type="submit" variant="outline" disabled={activeMutation.isPending} data-save-another="true">
                  {t(formKey('transactions.form.saveAndAddAnother'))}
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AccountField({
  id,
  label,
  accounts,
  selectedId,
  disabled,
  error,
  registration,
}: {
  id: string;
  label: string;
  accounts: { id: string; name: string; isActive?: boolean }[];
  selectedId: string;
  disabled: boolean;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm<EntryFormValues>>['register']>;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} aria-describedby={error ? `${id}-error` : undefined} aria-invalid={error !== undefined} disabled={disabled} {...registration}>
        <option value="">{t(formKey('transactions.form.accountPlaceholder'))}</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id} disabled={account.isActive === false && account.id !== selectedId}>
            {account.name}
          </option>
        ))}
      </NativeSelect>
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}
