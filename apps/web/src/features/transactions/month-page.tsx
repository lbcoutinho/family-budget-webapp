import {
  getListAccountBalancesQueryKey,
  getListCashboxBalancesQueryKey,
  getListTransactionsQueryOptions,
  getListTransactionsQueryKey,
  listTransactions,
  type CreateTransactionDto,
  type TransactionListItemDto,
  TransactionStatus,
  TransactionType,
  useCreateTransaction,
  useDeleteTransaction,
} from '@family-budget/api-client';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { type TFunction } from 'i18next';
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CreditCardIcon,
  FilterIcon,
  PencilIcon,
  PiggyBankIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { PageContent, PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BalancePanel } from '@/features/balances/balance-panel';
import { CashboxOperationDialog } from '@/features/transactions/cashbox-operation-dialog';
import { EntryDialog } from '@/features/transactions/entry-dialog';
import i18n, { type TranslationKey } from '@/i18n';
import { apiErrorMessage } from '@/lib/api-error';
import { currentMonthPath, formatMonth, monthPath, monthFromPathParams } from '@/lib/date';
import { formatCents } from '@/lib/money';

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

function dateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}-01`;
}

function localDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function formatEntryDate(value: string): string {
  const date = localDate(value);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function transactionAmount(transaction: TransactionListItemDto): number {
  if (transaction.type === TransactionType.EXPENSE || transaction.type === TransactionType.CASHBOX_IN) return -transaction.amount;
  if (transaction.type === TransactionType.INCOME || transaction.type === TransactionType.CASHBOX_OUT) return transaction.amount;

  return transaction.amount;
}

function typeLabel(type: TransactionType, t: TFunction): string {
  return t(`transactions.type.${type}` as TranslationKey);
}

function isCashboxOperation(type: TransactionType): boolean {
  return type === TransactionType.CASHBOX_IN || type === TransactionType.CASHBOX_OUT || type === TransactionType.CASHBOX_TRANSFER;
}

function restorePayload(entry: TransactionListItemDto): CreateTransactionDto {
  return {
    type: entry.type,
    amount: entry.amount,
    date: entry.date,
    description: entry.description,
    ...(entry.notes !== null ? { notes: entry.notes } : {}),
    ...(entry.isCreditCard ? { isCreditCard: true, referenceMonth: entry.referenceMonth } : {}),
    ...(entry.accountId ? { accountId: entry.accountId } : {}),
    ...(entry.destinationAccountId ? { destinationAccountId: entry.destinationAccountId } : {}),
    ...(entry.categoryId ? { categoryId: entry.categoryId } : {}),
    ...(entry.subcategoryId ? { subcategoryId: entry.subcategoryId } : {}),
    ...(entry.cashboxId ? { cashboxId: entry.cashboxId } : {}),
    ...(entry.destinationCashboxId ? { destinationCashboxId: entry.destinationCashboxId } : {}),
  };
}

function transactionDetail(transaction: TransactionListItemDto): string {
  if (isCashboxOperation(transaction.type)) {
    const [source, destination] =
      transaction.type === TransactionType.CASHBOX_IN
        ? [transaction.account?.name, transaction.cashboxLabel]
        : transaction.type === TransactionType.CASHBOX_OUT
          ? [transaction.cashboxLabel, transaction.account?.name]
          : [transaction.cashboxLabel, transaction.destinationCashboxLabel];

    return [source, destination].filter(Boolean).join(' → ');
  }

  const category = [transaction.category?.name, transaction.subcategory?.name].filter(Boolean).join(' · ');
  const account = transaction.account?.name;

  return [category, account].filter(Boolean).join(' — ');
}

function MonthPicker({ month, onSelect }: { month: Date; onSelect: (next: Date) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(month.getFullYear());

  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(i18n.language, { month: 'long' }).format(new Date(year, index, 1))),
    [year],
  );

  return (
    <div className="relative">
      <Button
        variant="ghost"
        className="h-auto min-w-[150px] border border-transparent bg-muted/70 px-2 py-1 font-display text-[1.05rem] font-bold tracking-[-0.02em] hover:bg-muted"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {formatMonth(month)}
      </Button>
      {open ? (
        <div
          role="dialog"
          aria-label={t('transactions.monthPicker')}
          className="absolute top-full left-1/2 z-30 mt-2 w-72 -translate-x-1/2 rounded-lg border bg-popover p-3 shadow-md"
        >
          <div className="mb-3 flex items-center justify-between">
            <Button variant="ghost" size="icon-sm" aria-label={t('transactions.previousYear')} onClick={() => setYear((value) => value - 1)}>
              <ChevronLeftIcon />
            </Button>
            <strong className="num">{year}</strong>
            <Button variant="ghost" size="icon-sm" aria-label={t('transactions.nextYear')} onClick={() => setYear((value) => value + 1)}>
              <ChevronRightIcon />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {monthNames.map((name, index) => {
              const selected = year === month.getFullYear() && index === month.getMonth();
              return (
                <Button
                  key={name}
                  size="sm"
                  variant={selected ? 'default' : 'ghost'}
                  className="justify-center capitalize"
                  onClick={() => {
                    onSelect(new Date(year, index, 1));
                    setOpen(false);
                  }}
                >
                  {name}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EntryMeta({ entry }: { entry: TransactionListItemDto }) {
  const { t } = useTranslation();
  const detail = transactionDetail(entry);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="truncate text-[14px] font-semibold">{entry.description}</span>
        {entry.isCreditCard ? <CreditCardIcon aria-label={t('transactions.creditCard')} className="size-3.5 shrink-0 text-muted-foreground" /> : null}
        {entry.status === TransactionStatus.DRAFT ? (
          <Badge variant="outline" className="border-dashed text-[10px]">
            {t('transactions.draft')}
          </Badge>
        ) : null}
        {isCashboxOperation(entry.type) ? (
          <Badge variant="outline" className="border-cashbox/30 bg-cashbox/10 text-[10px] text-cashbox">
            {typeLabel(entry.type, t)}
          </Badge>
        ) : null}
      </div>
      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
        {detail || typeLabel(entry.type, t)}
        {entry.isCreditCard ? ` · ${t('transactions.purchaseOn', { date: new Intl.DateTimeFormat(i18n.language).format(localDate(entry.date)) })}` : ''}
      </p>
    </div>
  );
}

function EntryAmount({ entry }: { entry: TransactionListItemDto }) {
  const { t } = useTranslation();
  const neutral = entry.type === TransactionType.TRANSFER || entry.type === TransactionType.CASHBOX_TRANSFER;
  const amount = neutral ? entry.amount : transactionAmount(entry);
  const tone =
    entry.type === TransactionType.EXPENSE
      ? 'text-destructive'
      : entry.type === TransactionType.INCOME
        ? 'text-emerald-700'
        : entry.type === TransactionType.TRANSFER || entry.type === TransactionType.CASHBOX_TRANSFER
          ? 'text-transfer'
          : 'text-cashbox';

  return (
    <span className={`num block whitespace-nowrap text-[14px] font-medium ${tone}`}>
      {formatCents(amount, { sign: !neutral })}
      {/* The list API does not supply running balances. */}
      {entry.status === TransactionStatus.CONFIRMED ? (
        <small className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{t('transactions.balancePlaceholder')}</small>
      ) : null}
    </span>
  );
}

function EntriesSkeleton() {
  return (
    <div className="space-y-px rounded-lg border p-3" aria-label="Loading entries">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}

/** The month ledger keeps confirmed data paginated while drafts stay visibly separate and excluded from totals. */
export function MonthPage() {
  const { year, month } = useParams();
  const referenceMonth = monthFromPathParams(year, month);

  if (!referenceMonth) return <Navigate to={currentMonthPath()} replace />;

  return <MonthLedger referenceMonth={referenceMonth} />;
}

function MonthLedger({ referenceMonth }: { referenceMonth: Date }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [cashboxOperationDialogOpen, setCashboxOperationDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionListItemDto>();
  const [deleting, setDeleting] = useState<TransactionListItemDto>();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);

  const invalidateTransactions = () => {
    void queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListAccountBalancesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListCashboxBalancesQueryKey() });
  };
  const restore = useCreateTransaction({
    mutation: {
      onSuccess: () => {
        invalidateTransactions();
        toast.success(t('transactions.undoRestored'));
      },
      onError: (error) => toast.error(apiErrorMessage(error, t)),
    },
  });
  const remove = useDeleteTransaction({
    mutation: {
      onSuccess: (_data, variables) => {
        const entry = deleting;
        setDeleting(undefined);
        invalidateTransactions();
        if (entry?.id !== variables.id) return;
        toast.success(t('transactions.deleted'), {
          duration: 10_000,
          action: {
            label: t('transactions.undo'),
            onClick: () => restore.mutate({ data: restorePayload(entry) }),
          },
        });
      },
      onError: (error) => {
        toast.error(apiErrorMessage(error, t));
      },
    },
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const referenceMonthFilter = dateOnly(referenceMonth);
  const confirmedParams = { referenceMonth: referenceMonthFilter, limit: PAGE_SIZE, ...(search ? { search } : {}) };
  const draftsParams = { referenceMonth: referenceMonthFilter, status: TransactionStatus.DRAFT, limit: PAGE_SIZE, ...(search ? { search } : {}) };
  const confirmedOptions = getListTransactionsQueryOptions(confirmedParams);
  const draftsOptions = getListTransactionsQueryOptions(draftsParams);

  const confirmed = useInfiniteQuery({
    queryKey: confirmedOptions.queryKey,
    queryFn: ({ pageParam, signal }) => listTransactions({ ...confirmedParams, ...(pageParam ? { cursor: pageParam } : {}) }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const drafts = useQuery(draftsOptions);

  const entries = useMemo(() => confirmed.data?.pages.flatMap((page) => page.items) ?? [], [confirmed.data]);
  const draftEntries = drafts.data?.items ?? [];
  const firstPage = confirmed.data?.pages[0];
  const allEntries = [...draftEntries, ...entries];
  const netTotal = (firstPage?.incomeTotal ?? 0) - (firstPage?.expenseTotal ?? 0);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !confirmed.hasNextPage || confirmed.isFetchingNextPage) return;
    const onIntersect: IntersectionObserverCallback = (records) => {
      if (records[0]?.isIntersecting) void confirmed.fetchNextPage();
    };
    const observer = new window.IntersectionObserver(onIntersect);
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Subscribe only when the observer inputs change, not on query object identity.
  }, [confirmed.fetchNextPage, confirmed.hasNextPage, confirmed.isFetchingNextPage]);

  const moveMonth = (offset: number) => {
    void navigate(monthPath(new Date(referenceMonth.getFullYear(), referenceMonth.getMonth() + offset, 1)));
  };
  const selectMonth = (next: Date) => {
    void navigate(monthPath(next));
  };
  const hasEntries = allEntries.length > 0;
  const loading = confirmed.isPending || drafts.isPending;
  const failed = confirmed.isError || drafts.isError;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={t('transactions.previousMonth')} onClick={() => moveMonth(-1)}>
              <ChevronLeftIcon />
            </Button>
            <MonthPicker key={referenceMonth.toISOString()} month={referenceMonth} onSelect={selectMonth} />
            <Button variant="ghost" size="icon-sm" aria-label={t('transactions.nextMonth')} onClick={() => moveMonth(1)}>
              <ChevronRightIcon />
            </Button>
            <Button variant="ghost" size="sm" className="text-[12.5px]" onClick={() => selectMonth(new Date())}>
              {t('transactions.today')}
            </Button>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-cashbox bg-cashbox-wash text-[12.5px] text-cashbox hover:border-cashbox hover:bg-cashbox hover:text-white"
              onClick={() => setCashboxOperationDialogOpen(true)}
            >
              <PiggyBankIcon />
              {t('transactions.moveCashbox')}
            </Button>
            <Button size="sm" className="text-[12.5px]" onClick={() => setEntryDialogOpen(true)}>
              <PlusIcon />
              {t('transactions.new')}
            </Button>
          </div>
        }
      />
      <PageContent className="space-y-4">
        <section className="rounded-lg border bg-card p-4 shadow-xs">
          <h2 className="font-semibold">{t('transactions.dailyExpense.title')}</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">{t('transactions.dailyExpense.description')}</p>
        </section>

        <BalancePanel />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-58">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                aria-label={t('transactions.search')}
                placeholder={t('transactions.search')}
                className="pl-8 text-[12.5px] md:text-[12.5px]"
              />
            </div>
            <Button variant="outline" size="sm" className="text-[12.5px]">
              <FilterIcon />
              {t('transactions.filters.type')}
            </Button>
            <Button variant="outline" size="sm" className="text-[12.5px]">
              {t('transactions.filters.category')}
            </Button>
            <Button variant="outline" size="sm" className="text-[12.5px]">
              {t('transactions.filters.account')}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="month-sort" className="text-[12.5px] text-muted-foreground">
              {t('transactions.sort.label')}
            </label>
            <select id="month-sort" className="h-8 rounded-md border bg-background px-2 text-[12.5px]">
              <option>{t('transactions.sort.newest')}</option>
              <option>{t('transactions.sort.oldest')}</option>
              <option>{t('transactions.sort.amountHighest')}</option>
              <option>{t('transactions.sort.amountLowest')}</option>
              <option>{t('transactions.sort.description')}</option>
            </select>
          </div>
        </div>

        {loading ? <EntriesSkeleton /> : null}
        {failed ? (
          <EmptyState
            icon={CalendarDaysIcon}
            title={t('transactions.error.title')}
            description={t('transactions.error.description')}
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void confirmed.refetch();
                  void drafts.refetch();
                }}
              >
                {t('common.retry')}
              </Button>
            }
          />
        ) : null}
        {!loading && !failed && !hasEntries ? (
          <EmptyState
            icon={CalendarDaysIcon}
            title={t('transactions.empty.title', { month: formatMonth(referenceMonth) })}
            description={t('transactions.empty.description')}
            action={
              <Button size="sm" onClick={() => setEntryDialogOpen(true)}>
                {t('transactions.new')}
              </Button>
            }
          />
        ) : null}
        {!loading && !failed && hasEntries ? (
          <section aria-labelledby="month-entries" className="overflow-hidden rounded-lg border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <h2 id="month-entries" className="font-semibold">
                {t('transactions.entries')}
              </h2>
              <p className="text-[11.5px] text-muted-foreground">
                {t('transactions.count', { count: firstPage?.total ?? 0 })} · {t('transactions.draftCount', { count: drafts.data?.total ?? 0 })}
              </p>
            </div>
            <div>
              {allEntries.map((entry) => (
                <article
                  key={entry.id}
                  className={`group grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-l-[3px] px-4 py-2.5 pl-[13px] hover:bg-muted shell:grid-cols-[48px_minmax(0,1fr)_auto_auto] shell:gap-y-0 ${entry.status === TransactionStatus.DRAFT ? 'bg-muted/60 opacity-60' : ''}`}
                  style={{
                    borderLeftColor:
                      entry.category?.color ??
                      (entry.type === TransactionType.CASHBOX_TRANSFER ? 'var(--transfer)' : isCashboxOperation(entry.type) ? 'var(--cashbox)' : 'transparent'),
                  }}
                >
                  <time className="num text-[12.5px] text-muted-foreground">{formatEntryDate(entry.date)}</time>
                  <EntryMeta entry={entry} />
                  <div className="text-right">
                    <EntryAmount entry={entry} />
                  </div>
                  <div className="col-start-2 col-end-4 flex justify-self-end shell:col-auto shell:justify-self-auto">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t('common.edit')}
                      className="opacity-50 transition-opacity group-hover:opacity-100"
                      onClick={() => {
                        setEditing(entry);
                        if (isCashboxOperation(entry.type)) setCashboxOperationDialogOpen(true);
                        else setEntryDialogOpen(true);
                      }}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t('common.delete')}
                      className="opacity-50 transition-opacity group-hover:opacity-100"
                      onClick={() => setDeleting(entry)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
            {confirmed.hasNextPage ? (
              <div ref={sentinel} className="flex min-h-11 items-center justify-center gap-2 border-t px-4 py-2 text-[12.5px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[12.5px]"
                  onClick={() => void confirmed.fetchNextPage()}
                  disabled={confirmed.isFetchingNextPage}
                >
                  {confirmed.isFetchingNextPage ? t('transactions.loadingMore') : t('transactions.loadMore')}
                </Button>
              </div>
            ) : null}
            <footer className="bg-muted/70 px-4 py-3 text-[13px]">
              <div className="flex justify-between">
                <span>{t('transactions.income')}</span>
                <span className="num text-emerald-700">{formatCents(firstPage?.incomeTotal ?? 0, { sign: true })}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>
                  {t('transactions.expense')} <small className="text-[11.5px] text-muted-foreground">{t('transactions.expenseExcludesCashboxes')}</small>
                </span>
                <span className="num text-destructive">{formatCents(-(firstPage?.expenseTotal ?? 0), { sign: true })}</span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 font-display text-[1.02rem] font-bold tracking-[-0.02em]">
                <span>{t('transactions.monthNet')}</span>
                <span className={`num ${netTotal >= 0 ? 'text-emerald-700' : 'text-destructive'}`}>{formatCents(netTotal, { sign: true })}</span>
              </div>
            </footer>
          </section>
        ) : null}
      </PageContent>
      <EntryDialog
        open={entryDialogOpen}
        onOpenChange={(open) => {
          setEntryDialogOpen(open);
          if (!open) setEditing(undefined);
        }}
        transaction={editing}
      />
      <CashboxOperationDialog
        open={cashboxOperationDialogOpen}
        onOpenChange={(open) => {
          setCashboxOperationDialogOpen(open);
          if (!open) setEditing(undefined);
        }}
        transaction={editing}
      />
      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(undefined);
        }}
        title={t('transactions.delete.title')}
        description={deleting ? `${deleting.description} · ${formatCents(deleting.amount)} · ${formatEntryDate(deleting.date)}` : ''}
        variant="destructive"
        confirmLabel={t('transactions.delete.confirm')}
        isPending={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate({ id: deleting.id });
        }}
      />
    </>
  );
}
