import {
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

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type TranslationKey } from '@/i18n';
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
  amount: string;
  isCreditCard: boolean;
  referenceMonth: string;
}

const entrySchema = z
  .object({
    type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']),
    date: z.string().min(1, 'transactions.form.required'),
    accountId: z.string().min(1, 'transactions.form.required'),
    destinationAccountId: z.string(),
    categoryId: z.string(),
    subcategoryId: z.string(),
    description: z.string().trim().min(1, 'transactions.form.required').max(200),
    amount: z.string().refine((value) => (parseCurrencyInput(value) ?? 0) > 0, 'transactions.form.invalidAmount'),
    isCreditCard: z.boolean(),
    referenceMonth: z.string(),
  })
  .superRefine((values, context) => {
    if (values.type === 'TRANSFER') {
      if (values.destinationAccountId.length === 0) context.addIssue({ code: 'custom', path: ['destinationAccountId'], message: 'transactions.form.required' });
      if (values.accountId === values.destinationAccountId && values.accountId.length > 0) {
        context.addIssue({ code: 'custom', path: ['destinationAccountId'], message: 'transactions.form.sameAccount' });
      }
      return;
    }

    for (const field of ['categoryId', 'subcategoryId'] as const) {
      if (values[field].length === 0) context.addIssue({ code: 'custom', path: [field], message: 'transactions.form.required' });
    }
    if (values.isCreditCard && values.referenceMonth.length === 0) {
      context.addIssue({ code: 'custom', path: ['referenceMonth'], message: 'transactions.form.required' });
    }
  });

const BUSINESS_CODE_FIELD: Record<string, keyof EntryFormValues | undefined> = {
  TRANSACTION_SAME_ACCOUNT: 'destinationAccountId',
  TRANSACTION_CATEGORY_KIND_MISMATCH: 'categoryId',
  TRANSACTION_SUBCATEGORY_PARENT_MISMATCH: 'subcategoryId',
};

/** The field errors are deliberately limited to codes that name one unambiguous input. */
export function businessCodeField(code: string | undefined): keyof EntryFormValues | undefined {
  return code === undefined ? undefined : BUSINESS_CODE_FIELD[code];
}

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

function formKey(key: string): TranslationKey {
  return key as TranslationKey;
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
  const [referenceMonthOverridden, setReferenceMonthOverridden] = useState(false);
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
    formState: { errors },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      type: (transaction?.type as EntryType | undefined) ?? 'EXPENSE',
      date: transaction?.date ?? today(),
      accountId: transaction?.accountId ?? '',
      destinationAccountId: transaction?.destinationAccountId ?? '',
      categoryId: transaction?.categoryId ?? '',
      subcategoryId: transaction?.subcategoryId ?? '',
      description: transaction?.description ?? '',
      amount: transaction ? formatCents(transaction.amount) : '',
      isCreditCard: transaction?.isCreditCard ?? false,
      referenceMonth: transaction?.referenceMonth?.slice(0, 7) ?? '',
    },
  });
  const [type, date, isCreditCard, selectedCategoryId, selectedSubcategoryId, referenceMonth, selectedAccountId, selectedDestinationAccountId] = useWatch({
    control,
    name: ['type', 'date', 'isCreditCard', 'categoryId', 'subcategoryId', 'referenceMonth', 'accountId', 'destinationAccountId'],
  });
  const categoryId = selectedCategoryId || undefined;
  const subcategoryId = selectedSubcategoryId || undefined;

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
            notes: null,
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
            account: accounts.find((account) => account.id === data.accountId) ?? null,
            category: null,
            subcategory: null,
          };
          // ponytail: mirrors #152's first-page shape; use plain invalidation if that cache changes.
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
          if (field === 'categoryId') categoryRef.current?.focus();
          if (field === 'subcategoryId') subcategoryRef.current?.focus();
        } else {
          toast.error(apiErrorMessage(error, t));
        }
      },
      onSuccess: () => {
        if (saveAnother.current) {
          const values = getValues();
          reset({ ...values, description: '', amount: '' });
          toast.success(t(formKey('transactions.form.save')));
          setTimeout(() => setFocus('description'));
        } else {
          onOpenChange(false);
        }
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getListAccountBalancesQueryKey() });
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
      amount: transaction ? formatCents(transaction.amount) : '',
      isCreditCard: transaction?.isCreditCard ?? false,
      referenceMonth: transaction?.referenceMonth?.slice(0, 7) ?? '',
    });
    queueMicrotask(() => setReferenceMonthOverridden(false));
  }, [open, reset, transaction]);

  useEffect(() => {
    const preservedEditReference = transaction?.isCreditCard && date === transaction.date && referenceMonth === transaction.referenceMonth.slice(0, 7);
    if (isCreditCard && !referenceMonthOverridden && !preservedEditReference) {
      setValue('referenceMonth', suggestedReferenceMonth(date).slice(0, 7), { shouldValidate: true });
    }
  }, [date, isCreditCard, referenceMonth, referenceMonthOverridden, setValue, transaction]);

  const changeType = (nextType: string) => {
    setValue('type', nextType as EntryType, { shouldValidate: true });
    setValue('categoryId', '');
    setValue('subcategoryId', '');
    setValue('isCreditCard', false);
    setValue('referenceMonth', '');
    setReferenceMonthOverridden(false);
  };

  const overrideReferenceMonth = () => {
    setReferenceMonthOverridden(true);
  };

  const submit = handleSubmit((values) => {
    const amount = parseCurrencyInput(values.amount);
    if (amount === null || amount <= 0) return;
    const payload: CreateTransactionDto = {
      type: values.type,
      amount,
      date: values.date,
      description: values.description.trim(),
      isCreditCard: values.type === 'TRANSFER' ? false : values.isCreditCard,
      accountId: values.accountId,
      ...(values.type === 'TRANSFER'
        ? { destinationAccountId: values.destinationAccountId }
        : {
            categoryId: values.categoryId,
            subcategoryId: values.subcategoryId,
            ...(values.isCreditCard ? { referenceMonth: `${values.referenceMonth}-01` } : {}),
          }),
    };
    if (!transaction) {
      mutation.mutate({ data: payload });
      return;
    }

    const update: UpdateTransactionDto = {};
    const changed = <K extends keyof UpdateTransactionDto>(key: K, value: UpdateTransactionDto[K], original: UpdateTransactionDto[K]) => {
      if (value !== original) update[key] = value;
    };
    changed('amount', payload.amount, transaction.amount);
    changed('date', payload.date, transaction.date);
    changed('description', payload.description, transaction.description);
    changed('isCreditCard', payload.isCreditCard, transaction.isCreditCard);
    changed('accountId', payload.accountId, transaction.accountId ?? undefined);
    changed('destinationAccountId', payload.destinationAccountId, transaction.destinationAccountId ?? undefined);
    changed('categoryId', payload.categoryId, transaction.categoryId ?? undefined);
    changed('subcategoryId', payload.subcategoryId, transaction.subcategoryId ?? undefined);
    if (values.isCreditCard && `${values.referenceMonth}-01` !== transaction.referenceMonth) update.referenceMonth = `${values.referenceMonth}-01`;
    updateMutation.mutate({ id: transaction.id, data: update });
  });

  const accountsEmpty = accounts.length === 0;
  return (
    <Dialog open={open} onOpenChange={activeMutation.isPending ? undefined : onOpenChange}>
      <DialogContent
        showCloseButton={!activeMutation.isPending}
        onEscapeKeyDown={activeMutation.isPending ? (event) => event.preventDefault() : undefined}
        onPointerDownOutside={activeMutation.isPending ? (event) => event.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle>{t(formKey('transactions.form.title'))}</DialogTitle>
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
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <CategorySelect
                    kind={type}
                    categoryId={categoryId}
                    subcategoryId={subcategoryId}
                    disabled={activeMutation.isPending}
                    categoryDescribedBy={errors.categoryId ? 'entry-category-error' : undefined}
                    subcategoryDescribedBy={errors.subcategoryId ? 'entry-subcategory-error' : undefined}
                    categoryInvalid={errors.categoryId !== undefined}
                    subcategoryInvalid={errors.subcategoryId !== undefined}
                    categoryRef={categoryRef}
                    subcategoryRef={subcategoryRef}
                    onChange={(nextCategory, nextSubcategory) => {
                      setValue('categoryId', nextCategory ?? '', { shouldValidate: true });
                      setValue('subcategoryId', nextSubcategory ?? '', { shouldValidate: true });
                    }}
                  />
                </div>
                <FieldError id="entry-category-error" error={errors.categoryId?.message} />
                <FieldError id="entry-subcategory-error" error={errors.subcategoryId?.message} />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="entry-credit-card"
                    checked={isCreditCard}
                    disabled={activeMutation.isPending}
                    onCheckedChange={(checked) => {
                      const next = checked === true;
                      setValue('isCreditCard', next, { shouldValidate: true });
                      setValue('referenceMonth', next ? suggestedReferenceMonth(date).slice(0, 7) : '');
                      setReferenceMonthOverridden(false);
                    }}
                  />
                  <Label htmlFor="entry-credit-card">{t(formKey('transactions.form.creditCard'))}</Label>
                </div>
                {isCreditCard ? (
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
                ) : null}
              </>
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
            <div className="grid gap-1.5">
              <Label htmlFor="entry-amount">{t(formKey('transactions.form.amount'))}</Label>
              <Input
                id="entry-amount"
                inputMode="decimal"
                className="text-right tabular-nums"
                placeholder={t(formKey('transactions.form.amountPlaceholder'))}
                aria-describedby={`entry-amount-hint${errors.amount ? ' entry-amount-error' : ''}`}
                aria-invalid={errors.amount !== undefined}
                disabled={activeMutation.isPending}
                {...register('amount', {
                  onBlur: (event: FocusEvent<HTMLInputElement>) => {
                    const cents = parseCurrencyInput(event.target.value);
                    if (cents !== null) setValue('amount', formatCents(cents), { shouldValidate: true });
                  },
                })}
              />
              <p id="entry-amount-hint" className="text-xs text-muted-foreground">
                {t(formKey('transactions.form.amountHint'))}
              </p>
              <FieldError id="entry-amount-error" error={errors.amount?.message} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={activeMutation.isPending}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={activeMutation.isPending}>
                {activeMutation.isPending ? <Loader2Icon className="animate-spin" /> : null}
                {t(formKey('transactions.form.save'))}
              </Button>
              <Button type="submit" variant="outline" disabled={activeMutation.isPending} data-save-another="true">
                {t(formKey('transactions.form.saveAndAddAnother'))}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ id, error }: { id?: string; error?: string }) {
  const { t } = useTranslation();
  return error ? (
    <p id={id} className="text-xs text-destructive">
      {t(formKey(error))}
    </p>
  ) : null;
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
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error !== undefined}
        disabled={disabled}
        {...registration}
      >
        <option value="" />
        {accounts.map((account) => (
          <option key={account.id} value={account.id} disabled={account.isActive === false && account.id !== selectedId}>
            {account.name}
          </option>
        ))}
      </select>
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}
