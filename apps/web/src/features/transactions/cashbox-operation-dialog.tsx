import {
  getListAccountBalancesQueryKey,
  getListCashboxBalancesQueryKey,
  getListTransactionsQueryKey,
  type CreateTransactionDto,
  type UpdateTransactionDto,
  type TransactionListDto,
  type TransactionListItemDto,
  TransactionStatus,
  useCreateTransaction,
  useUpdateTransaction,
  useListAccountBalances,
  useListAccounts,
  useListCashboxBalances,
  useListCashboxes,
} from '@family-budget/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';
import { useEffect, useState, type FocusEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import * as z from 'zod';

import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type TranslationKey } from '@/i18n';
import { apiErrorMessage } from '@/lib/api-error';
import { formatCents, parseCurrencyInput } from '@/lib/money';

type CashboxOperationMode = 'deposit' | 'withdrawal' | 'transfer';

interface CashboxOperationFormValues {
  mode: CashboxOperationMode;
  accountId: string;
  cashboxId: string;
  destinationCashboxId: string;
  amount: string;
  date: string;
  description: string;
}

type CashboxOperationPayloadValues = Omit<CashboxOperationFormValues, 'mode' | 'amount'> & { amount: number };

const MODE = {
  deposit: { type: 'CASHBOX_IN', fields: ['accountId', 'cashboxId'] },
  withdrawal: { type: 'CASHBOX_OUT', fields: ['accountId', 'cashboxId'] },
  transfer: { type: 'CASHBOX_TRANSFER', fields: ['cashboxId', 'destinationCashboxId'] },
} as const satisfies Record<CashboxOperationMode, { type: CreateTransactionDto['type']; fields: readonly (keyof CashboxOperationFormValues)[] }>;

const cashboxOperationSchema = z
  .object({
    mode: z.enum(['deposit', 'withdrawal', 'transfer']),
    accountId: z.string(),
    cashboxId: z.string(),
    destinationCashboxId: z.string(),
    amount: z.string().refine((value) => (parseCurrencyInput(value) ?? 0) > 0, 'transactions.form.invalidAmount'),
    date: z.string().min(1, 'transactions.form.required'),
    description: z.string().trim().min(1, 'transactions.form.required').max(200),
  })
  .superRefine((values, context) => {
    for (const field of MODE[values.mode].fields) {
      if (values[field].length === 0) {
        context.addIssue({ code: 'custom', path: [field], message: 'transactions.form.required' });
      }
    }
    if (values.mode === 'transfer' && values.cashboxId !== '' && values.cashboxId === values.destinationCashboxId) {
      context.addIssue({ code: 'custom', path: ['destinationCashboxId'], message: 'transactions.cashboxOperation.sameCashbox' });
    }
  });

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

/** Keeps the API's mutually-exclusive transaction references in one client-side map. */
export function cashboxOperationPayload(mode: CashboxOperationMode, values: CashboxOperationPayloadValues): CreateTransactionDto {
  const references = Object.fromEntries(MODE[mode].fields.map((field) => [field, values[field]]));
  return { type: MODE[mode].type, amount: values.amount, date: values.date, description: values.description.trim(), ...references };
}

export function cashboxOperationUpdatePayload(
  transaction: TransactionListItemDto,
  mode: CashboxOperationMode,
  values: CashboxOperationPayloadValues,
): UpdateTransactionDto {
  const payload: UpdateTransactionDto = {};
  if (values.amount !== transaction.amount) payload.amount = values.amount;
  if (values.date !== transaction.date) payload.date = values.date;
  if (values.description.trim() !== transaction.description) payload.description = values.description.trim();

  for (const field of MODE[mode].fields as readonly ('accountId' | 'cashboxId' | 'destinationCashboxId')[]) {
    const next = values[field] || undefined;
    const previous = transaction[field] ?? undefined;
    if (next !== previous && next !== undefined) payload[field] = next;
  }

  return payload;
}

function modeFromTransaction(transaction?: TransactionListItemDto): CashboxOperationMode {
  if (transaction?.type === 'CASHBOX_OUT') return 'withdrawal';
  if (transaction?.type === 'CASHBOX_TRANSFER') return 'transfer';
  return 'deposit';
}

function deletedCashbox(transaction: TransactionListItemDto | undefined, field: 'cashboxId' | 'destinationCashboxId'): string | undefined {
  if (transaction?.[field] !== null) return undefined;
  return field === 'cashboxId' ? (transaction.cashboxLabel ?? undefined) : (transaction.destinationCashboxLabel ?? undefined);
}

function availableBalanceFromError(error: unknown): number | undefined {
  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  const match = typeof message === 'string' ? /available balance:\s*(-?\d+)\s+cents/i.exec(message) : null;
  return match ? Number(match[1]) : undefined;
}

export interface CashboxOperationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** #156 supplies this for its edit flow; creation remains this dialog's only mutation today. */
  transaction?: TransactionListItemDto;
}

export function CashboxOperationDialog({ open, onOpenChange, transaction }: CashboxOperationDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useListAccounts();
  const { data: cashboxes = [] } = useListCashboxes();
  const { data: accountBalances = [] } = useListAccountBalances();
  const { data: cashboxBalances = [] } = useListCashboxBalances();
  const [balanceWarning, setBalanceWarning] = useState<number>();
  const [submissionError, setSubmissionError] = useState<string>();
  const activeAccounts = accounts.filter((account) => account.isActive);
  const activeCashboxes = cashboxes.filter((cashbox) => cashbox.isActive);
  const accountBalanceById = new Map(accountBalances.map((balance) => [balance.accountId, balance]));
  const cashboxBalanceById = new Map(cashboxBalances.map((balance) => [balance.cashboxId, balance]));
  const defaultMode = modeFromTransaction(transaction);
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CashboxOperationFormValues>({
    resolver: zodResolver(cashboxOperationSchema),
    defaultValues: {
      mode: defaultMode,
      accountId: transaction?.accountId ?? '',
      cashboxId: transaction?.cashboxId ?? '',
      destinationCashboxId: transaction?.destinationCashboxId ?? '',
      amount: transaction ? formatCents(transaction.amount) : '',
      date: transaction?.date ?? today(),
      description: transaction?.description ?? '',
    },
  });
  const [mode, accountId, cashboxId, destinationCashboxId] = useWatch({ control, name: ['mode', 'accountId', 'cashboxId', 'destinationCashboxId'] });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListAccountBalancesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListCashboxBalancesQueryKey() });
  };
  const handleSuccess = () => {
    setBalanceWarning(undefined);
    setSubmissionError(undefined);
    onOpenChange(false);
  };
  const handleError = (error: unknown) => {
    const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
    if (code === 'CASHBOX_INSUFFICIENT_FUNDS') {
      setSubmissionError(t('errors.CASHBOX_INSUFFICIENT_FUNDS', { amount: formatCents(availableBalanceFromError(error) ?? 0) }));
    } else {
      setSubmissionError(apiErrorMessage(error, t));
    }
  };
  const createMutation = useCreateTransaction({
    mutation: {
      onMutate: async ({ data }) => {
        const referenceMonth = referenceMonthFromDate(data.date);
        const key = getListTransactionsQueryKey({ referenceMonth, limit: 30 });
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
            referenceMonth,
            description: data.description,
            notes: null,
            isCreditCard: false,
            accountId: data.accountId ?? null,
            destinationAccountId: null,
            categoryId: null,
            subcategoryId: null,
            cashboxId: data.cashboxId ?? null,
            destinationCashboxId: data.destinationCashboxId ?? null,
            cashboxLabel: data.cashboxId ? (cashboxes.find((cashbox) => cashbox.id === data.cashboxId)?.name ?? null) : null,
            destinationCashboxLabel: data.destinationCashboxId ? (cashboxes.find((cashbox) => cashbox.id === data.destinationCashboxId)?.name ?? null) : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            account: accounts.find((account) => account.id === data.accountId) ?? null,
            category: null,
            subcategory: null,
          };
          queryClient.setQueryData<InfiniteData<TransactionListDto>>(key, {
            ...previous,
            pages: previous.pages.map((page, index) =>
              index === 0
                ? {
                    ...page,
                    items: [optimistic, ...page.items],
                    total: page.total + 1,
                    cashboxInTotal: page.cashboxInTotal + (data.type === 'CASHBOX_IN' ? data.amount : 0),
                    cashboxOutTotal: page.cashboxOutTotal + (data.type === 'CASHBOX_OUT' ? data.amount : 0),
                  }
                : page,
            ),
          });
        }
        return { key, previous };
      },
      onError: (error, _variables, context) => {
        if (context?.previous) queryClient.setQueryData(context.key, context.previous);
        handleError(error);
      },
      onSuccess: handleSuccess,
      onSettled: invalidate,
    },
  });
  const updateMutation = useUpdateTransaction({
    mutation: { onError: handleError, onSuccess: handleSuccess, onSettled: invalidate },
  });
  const mutation = transaction ? updateMutation : createMutation;

  useEffect(() => {
    if (!open) return;
    reset({
      mode: defaultMode,
      accountId: transaction?.accountId ?? '',
      cashboxId: transaction?.cashboxId ?? '',
      destinationCashboxId: transaction?.destinationCashboxId ?? '',
      amount: transaction ? formatCents(transaction.amount) : '',
      date: transaction?.date ?? today(),
      description: transaction?.description ?? '',
    });
    queueMicrotask(() => {
      setBalanceWarning(undefined);
      setSubmissionError(undefined);
    });
  }, [defaultMode, open, reset, transaction]);

  const changeMode = (nextMode: string) => {
    setValue('mode', nextMode as CashboxOperationMode, { shouldValidate: true });
    setValue('accountId', '');
    setValue('cashboxId', '');
    setValue('destinationCashboxId', '');
    setBalanceWarning(undefined);
  };

  const sourceCashboxId = mode === 'transfer' || mode === 'withdrawal' ? cashboxId : undefined;
  const submit = handleSubmit((values) => {
    const amount = parseCurrencyInput(values.amount);
    if (amount === null || amount <= 0) return;
    const balance = sourceCashboxId ? cashboxBalanceById.get(sourceCashboxId)?.balance : undefined;
    // ponytail: advisory only; the backend is the concurrent source of truth.
    setBalanceWarning(balance !== undefined && amount > balance ? balance : undefined);
    setSubmissionError(undefined);
    if (transaction) {
      updateMutation.mutate({ id: transaction.id, data: cashboxOperationUpdatePayload(transaction, values.mode, { ...values, amount }) });
    } else {
      createMutation.mutate({ data: cashboxOperationPayload(values.mode, { ...values, amount }) });
    }
  });

  const cashboxesEmpty = activeCashboxes.length === 0;
  const accountsEmpty = activeAccounts.length === 0;
  const transferUnavailable = activeCashboxes.length < 2;
  const deletedSource = deletedCashbox(transaction, 'cashboxId');
  const deletedDestination = deletedCashbox(transaction, 'destinationCashboxId');

  return (
    <Dialog open={open} onOpenChange={mutation.isPending ? undefined : onOpenChange}>
      <DialogContent
        showCloseButton={!mutation.isPending}
        onEscapeKeyDown={mutation.isPending ? (event) => event.preventDefault() : undefined}
        onPointerDownOutside={mutation.isPending ? (event) => event.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle>{t('transactions.cashboxOperation.title')}</DialogTitle>
        </DialogHeader>
        {cashboxesEmpty ? (
          <EmptyState
            title={t('transactions.cashboxOperation.noCashboxes')}
            action={
              <Button asChild size="sm">
                <Link to="/cashboxes">{t('transactions.cashboxOperation.createCashbox')}</Link>
              </Button>
            }
          />
        ) : (
          <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-3.5">
            <Tabs value={mode} onValueChange={changeMode}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="deposit">{t('transactions.cashboxOperation.deposit')}</TabsTrigger>
                <TabsTrigger value="withdrawal">{t('transactions.cashboxOperation.withdrawal')}</TabsTrigger>
                <TabsTrigger value="transfer" disabled={transferUnavailable}>
                  {t('transactions.cashboxOperation.transfer')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {transferUnavailable ? <p className="text-xs text-muted-foreground">{t('transactions.cashboxOperation.transferUnavailable')}</p> : null}
            {accountsEmpty && mode !== 'transfer' ? (
              <EmptyState
                title={t('transactions.cashboxOperation.noAccounts')}
                action={
                  <Button asChild size="sm">
                    <Link to="/accounts">{t('transactions.form.createAccount')}</Link>
                  </Button>
                }
              />
            ) : (
              <>
                {mode === 'deposit' ? (
                  <>
                    <BalanceSelect
                      id="cashbox-operation-account"
                      label={t('transactions.cashboxOperation.sourceAccount')}
                      value={accountId}
                      onChange={(value) => setValue('accountId', value, { shouldValidate: true })}
                      options={activeAccounts.map((account) => ({ id: account.id, name: account.name, balance: accountBalanceById.get(account.id)?.balance }))}
                      error={errors.accountId?.message}
                      disabled={mutation.isPending}
                    />
                    <CashboxField
                      id="cashbox-operation-cashbox"
                      label={t('transactions.cashboxOperation.destinationCashbox')}
                      value={cashboxId}
                      onChange={(value) => {
                        setValue('cashboxId', value, { shouldValidate: true });
                        setBalanceWarning(undefined);
                      }}
                      options={activeCashboxes}
                      balances={cashboxBalanceById}
                      error={errors.cashboxId?.message}
                      disabled={mutation.isPending}
                      deletedLabel={deletedSource}
                    />
                  </>
                ) : null}
                {mode === 'withdrawal' ? (
                  <>
                    <CashboxField
                      id="cashbox-operation-cashbox"
                      label={t('transactions.cashboxOperation.sourceCashbox')}
                      value={cashboxId}
                      onChange={(value) => {
                        setValue('cashboxId', value, { shouldValidate: true });
                        setBalanceWarning(undefined);
                      }}
                      options={activeCashboxes}
                      balances={cashboxBalanceById}
                      error={errors.cashboxId?.message}
                      disabled={mutation.isPending}
                      deletedLabel={deletedSource}
                    />
                    <BalanceSelect
                      id="cashbox-operation-account"
                      label={t('transactions.cashboxOperation.destinationAccount')}
                      value={accountId}
                      onChange={(value) => setValue('accountId', value, { shouldValidate: true })}
                      options={activeAccounts.map((account) => ({ id: account.id, name: account.name, balance: accountBalanceById.get(account.id)?.balance }))}
                      error={errors.accountId?.message}
                      disabled={mutation.isPending}
                    />
                  </>
                ) : null}
                {mode === 'transfer' ? (
                  <>
                    <CashboxField
                      id="cashbox-operation-cashbox"
                      label={t('transactions.cashboxOperation.sourceCashbox')}
                      value={cashboxId}
                      onChange={(value) => {
                        setValue('cashboxId', value, { shouldValidate: true });
                        setBalanceWarning(undefined);
                      }}
                      options={activeCashboxes}
                      balances={cashboxBalanceById}
                      error={errors.cashboxId?.message}
                      disabled={mutation.isPending}
                      deletedLabel={deletedSource}
                    />
                    <CashboxField
                      id="cashbox-operation-destination-cashbox"
                      label={t('transactions.cashboxOperation.destinationCashbox')}
                      value={destinationCashboxId}
                      onChange={(value) => {
                        setValue('destinationCashboxId', value, { shouldValidate: true });
                        setBalanceWarning(undefined);
                      }}
                      options={activeCashboxes}
                      balances={cashboxBalanceById}
                      error={errors.destinationCashboxId?.message}
                      disabled={mutation.isPending}
                      deletedLabel={deletedDestination}
                    />
                  </>
                ) : null}
                <div className="grid gap-1.5">
                  <Label htmlFor="cashbox-operation-amount">{t('transactions.form.amount')}</Label>
                  <Input
                    id="cashbox-operation-amount"
                    inputMode="decimal"
                    className="text-right tabular-nums"
                    placeholder={t('transactions.form.amountPlaceholder')}
                    aria-describedby={`cashbox-operation-amount-hint${errors.amount ? ' cashbox-operation-amount-error' : ''}`}
                    aria-invalid={errors.amount !== undefined}
                    disabled={mutation.isPending}
                    {...register('amount', {
                      onBlur: (event: FocusEvent<HTMLInputElement>) => {
                        const cents = parseCurrencyInput(event.target.value);
                        if (cents !== null) setValue('amount', formatCents(cents), { shouldValidate: true });
                      },
                    })}
                  />
                  <p id="cashbox-operation-amount-hint" className="text-xs text-muted-foreground">
                    {t('transactions.form.amountHint')}
                  </p>
                  <FieldError id="cashbox-operation-amount-error" error={errors.amount?.message} />
                  {balanceWarning !== undefined ? (
                    <p className="border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                      {t('transactions.cashboxOperation.insufficientWarning', { amount: formatCents(balanceWarning) })}
                    </p>
                  ) : null}
                </div>
                {mode === 'deposit' ? <InfoCallout>{t('transactions.cashboxOperation.depositInfo')}</InfoCallout> : null}
                {mode === 'transfer' ? <InfoCallout>{t('transactions.cashboxOperation.transferInfo')}</InfoCallout> : null}
                <div className="grid gap-1.5">
                  <Label htmlFor="cashbox-operation-date">{t('transactions.form.date')}</Label>
                  <Input
                    id="cashbox-operation-date"
                    type="date"
                    aria-describedby={errors.date ? 'cashbox-operation-date-error' : undefined}
                    aria-invalid={errors.date !== undefined}
                    disabled={mutation.isPending}
                    {...register('date')}
                  />
                  <FieldError id="cashbox-operation-date-error" error={errors.date?.message} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cashbox-operation-description">{t('transactions.form.description')}</Label>
                  <Input
                    id="cashbox-operation-description"
                    aria-describedby={errors.description ? 'cashbox-operation-description-error' : undefined}
                    aria-invalid={errors.description !== undefined}
                    disabled={mutation.isPending}
                    {...register('description')}
                  />
                  <FieldError id="cashbox-operation-description-error" error={errors.description?.message} />
                </div>
                {submissionError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {submissionError}
                  </p>
                ) : null}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? <Loader2Icon className="animate-spin" /> : null}
                    {t('transactions.form.save')}
                  </Button>
                </DialogFooter>
              </>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  const { t } = useTranslation();
  return error ? (
    <p id={id} className="text-xs text-destructive">
      {t(formKey(error))}
    </p>
  ) : null;
}

function InfoCallout({ children }: { children: string }) {
  return <p className="border-l-2 border-transfer bg-transfer-wash px-3 py-2 text-xs text-transfer">{children}</p>;
}

function BalanceSelect({
  id,
  label,
  value,
  onChange,
  options,
  error,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string; balance?: number }[];
  error?: string;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs text-muted-foreground">{formatCents(options.find((option) => option.id === value)?.balance ?? 0)}</span>
      </div>
      <select
        id={id}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error !== undefined}
        disabled={disabled}
      >
        <option value="" />
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

function CashboxField({
  id,
  label,
  value,
  onChange,
  options,
  balances,
  error,
  disabled,
  deletedLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
  balances: Map<string, { balance: number }>;
  error?: string;
  disabled: boolean;
  deletedLabel?: string;
}) {
  const { t } = useTranslation();
  if (deletedLabel)
    return (
      <div className="grid gap-1.5">
        <Label>{label}</Label>
        <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          <span>{deletedLabel}</span>
          <Badge variant="secondary">{`(${t('transactions.cashboxOperation.deletedCashbox')})`}</Badge>
        </div>
        <BalanceSelect
          id={`${id}-replacement`}
          label={t('transactions.cashboxOperation.newCashbox')}
          value={value}
          onChange={onChange}
          options={options.map((cashbox) => ({ ...cashbox, balance: balances.get(cashbox.id)?.balance }))}
          error={error}
          disabled={disabled}
        />
      </div>
    );
  return (
    <BalanceSelect
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      options={options.map((cashbox) => ({ ...cashbox, balance: balances.get(cashbox.id)?.balance }))}
      error={error}
      disabled={disabled}
    />
  );
}
