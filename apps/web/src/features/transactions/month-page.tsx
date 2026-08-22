import {
  getListAccountBalancesQueryKey,
  getListCashboxBalancesQueryKey,
  getListTransactionsQueryOptions,
  getListTransactionsQueryKey,
  listTransactions,
  useListAccounts,
  useListCategories,
  type CreateTransactionDto,
  type TransactionListItemDto,
  TransactionSort,
  TransactionSource,
  TransactionStatus,
  TransactionType,
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
} from '@family-budget/api-client';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { type TFunction } from 'i18next';
import {
  CalendarDaysIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CreditCardIcon,
  FilterIcon,
  PencilIcon,
  PiggyBankIcon,
  PlusIcon,
  RepeatIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { PageContent, PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BalancePanel } from '@/features/balances/balance-panel';
import { CashboxOperationDialog } from '@/features/transactions/cashbox-operation-dialog';
import { DailyExpenseStrip, getDailyExpensesQueryKey } from '@/features/transactions/daily-expense-strip';
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

function transactionAmount(transaction: TransactionListItemDto): number | null {
  if (transaction.amount === null) return null;
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

/** Only called once the caller has checked `entry.amount !== null` (ADR-0020, no `restorePayload` for an amountless draft). */
function restorePayload(entry: TransactionListItemDto & { amount: number }): CreateTransactionDto {
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

function transactionDetail(transaction: TransactionListItemDto, accountNames: Map<string, string>): string {
  if (isCashboxOperation(transaction.type)) {
    const [source, destination] =
      transaction.type === TransactionType.CASHBOX_IN
        ? [transaction.account?.name, transaction.cashboxLabel]
        : transaction.type === TransactionType.CASHBOX_OUT
          ? [transaction.cashboxLabel, transaction.account?.name]
          : [transaction.cashboxLabel, transaction.destinationCashboxLabel];

    return [source, destination].filter(Boolean).join(' → ');
  }

  if (transaction.type === TransactionType.TRANSFER) {
    return [
      transaction.account?.name ?? (transaction.accountId ? accountNames.get(transaction.accountId) : undefined),
      transaction.destinationAccountId ? accountNames.get(transaction.destinationAccountId) : undefined,
    ]
      .filter(Boolean)
      .join(' → ');
  }

  const category = [transaction.category?.name, transaction.subcategory?.name].filter(Boolean).join(' · ');
  const account = transaction.account?.name ?? (transaction.accountId ? accountNames.get(transaction.accountId) : undefined);

  return [category, account].filter(Boolean).join(' — ');
}

/** Exported so the reports feature can reuse the same prev/next-plus-grid control over its own URL
 * state instead of `/month`'s route (`plans/screens/AGENTS.md` §M6-T03 step 1). */
export function MonthPicker({ month, onSelect }: { month: Date; onSelect: (next: Date) => void }) {
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

const FILTER_ALL = 'all';

/** One shape backs the type/category/account filter triggers — each has exactly one call site
 * below, so this stays local rather than becoming a shared component. Radix rejects `""` as an
 * item value, hence the `FILTER_ALL` sentinel mapped to/from `undefined` at the boundary. */
function FilterSelect({
  value,
  onChange,
  allLabel,
  ariaLabel,
  options,
  icon,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  allLabel: string;
  ariaLabel: string;
  options: { id: string; name: string }[];
  icon?: ReactNode;
}) {
  return (
    <Select value={value ?? FILTER_ALL} onValueChange={(next) => onChange(next === FILTER_ALL ? undefined : next)}>
      <SelectTrigger size="sm" aria-label={ariaLabel} className="text-[12.5px]">
        {icon}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={FILTER_ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EntryMeta({ entry, accountNames }: { entry: TransactionListItemDto; accountNames: Map<string, string> }) {
  const { t } = useTranslation();
  const detail = transactionDetail(entry, accountNames);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="truncate text-[14px] font-semibold">{entry.description}</span>
        {entry.isCreditCard ? <CreditCardIcon aria-label={t('transactions.creditCard')} className="size-3.5 shrink-0 text-muted-foreground" /> : null}
        {entry.source === TransactionSource.RECURRING ? (
          <RepeatIcon
            aria-label={
              entry.installmentNumber !== null && entry.installmentTotal !== null
                ? t('transactions.recurringInstallment', { index: entry.installmentNumber, total: entry.installmentTotal })
                : t('transactions.recurring')
            }
            className="size-3.5 shrink-0 text-muted-foreground"
          />
        ) : null}
        {entry.installmentNumber !== null && entry.installmentTotal !== null ? (
          <span className="num text-[11px] text-muted-foreground">
            {t('transactions.installmentOf', { index: entry.installmentNumber, total: entry.installmentTotal })}
          </span>
        ) : null}
        {entry.status === TransactionStatus.DRAFT ? (
          <Badge variant="outline" className="border-dashed text-[10.5px]">
            {t('transactions.draft')}
          </Badge>
        ) : null}
        {isCashboxOperation(entry.type) ? (
          <Badge variant="outline" className="border-cashbox/30 bg-cashbox/10 text-[10.5px] text-cashbox">
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
  const [typeFilter, setTypeFilter] = useState<TransactionType>();
  // `?categoryId=` is what makes a report's category link real (M6-T03): read once on mount, same
  // as every other filter here, which all live in local state rather than the URL.
  const [searchParams] = useSearchParams();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(() => searchParams.get('categoryId') ?? undefined);
  const [accountFilter, setAccountFilter] = useState<string>();
  const [sort, setSort] = useState<TransactionSort>(TransactionSort.newest);
  const [selectedDay, setSelectedDay] = useState<string>();
  // A day filter belongs to the month it was picked in — comparing against the last
  // `referenceMonth` seen (rather than an effect) clears it the moment navigation swaps in a new
  // month, without an extra render/paint round trip.
  const [dayFilterMonth, setDayFilterMonth] = useState(referenceMonth);
  const sentinel = useRef<HTMLDivElement>(null);

  if (dayFilterMonth !== referenceMonth) {
    setDayFilterMonth(referenceMonth);
    setSelectedDay(undefined);
  }

  const toggleDay = (date: string) => setSelectedDay((current) => (current === date ? undefined : date));

  const invalidateTransactions = () => {
    void queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListAccountBalancesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListCashboxBalancesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getDailyExpensesQueryKey() });
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
        const amount = entry.amount;
        // An amountless draft (ADR-0020) has no `restorePayload`: `POST /transactions` always
        // creates a CONFIRMED row, and CONFIRMED requires an amount — nothing to replay it with.
        toast.success(t('transactions.deleted'), {
          duration: 10_000,
          ...(amount !== null
            ? { action: { label: t('transactions.undo'), onClick: () => restore.mutate({ data: restorePayload({ ...entry, amount }) }) } }
            : {}),
        });
      },
      onError: (error) => {
        toast.error(apiErrorMessage(error, t));
      },
    },
  });
  const confirm = useUpdateTransaction({
    mutation: {
      onSuccess: () => {
        invalidateTransactions();
        toast.success(t('transactions.confirmed'));
      },
      onError: (error) => toast.error(apiErrorMessage(error, t)),
    },
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const referenceMonthFilter = dateOnly(referenceMonth);
  const dayFilter = selectedDay ? { dateFrom: selectedDay, dateTo: selectedDay } : {};
  const activeFilters = {
    ...(search ? { search } : {}),
    ...(typeFilter ? { type: [typeFilter] } : {}),
    ...(categoryFilter ? { categoryId: categoryFilter } : {}),
    ...(accountFilter ? { accountId: accountFilter } : {}),
    ...dayFilter,
  };
  const hasActiveFilters = search !== '' || typeFilter !== undefined || categoryFilter !== undefined || accountFilter !== undefined;
  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setTypeFilter(undefined);
    setCategoryFilter(undefined);
    setAccountFilter(undefined);
  };
  const confirmedParams = { referenceMonth: referenceMonthFilter, limit: PAGE_SIZE, sort, ...activeFilters };
  const draftsParams = { referenceMonth: referenceMonthFilter, status: TransactionStatus.DRAFT, limit: PAGE_SIZE, sort, ...activeFilters };
  const confirmedOptions = getListTransactionsQueryOptions(confirmedParams);
  const draftsOptions = getListTransactionsQueryOptions(draftsParams);

  const confirmed = useInfiniteQuery({
    queryKey: confirmedOptions.queryKey,
    queryFn: ({ pageParam, signal }) => listTransactions({ ...confirmedParams, ...(pageParam ? { cursor: pageParam } : {}) }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const drafts = useQuery(draftsOptions);

  const { data: categories = [] } = useListCategories({ tree: false });
  const categoryOptions = categories.filter((category) => category.parentId === null).map((category) => ({ id: category.id, name: category.name }));
  const { data: accounts = [] } = useListAccounts();
  const accountOptions = accounts.map((account) => ({ id: account.id, name: account.name }));
  const accountNames = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const typeOptions = Object.values(TransactionType).map((type) => ({ id: type, name: t(`transactions.filters.typeOption.${type}` as TranslationKey) }));

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
        <DailyExpenseStrip referenceMonth={referenceMonth} selectedDate={selectedDay} onToggleDay={toggleDay} />

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
            <FilterSelect
              value={typeFilter}
              onChange={(value) => setTypeFilter(value as TransactionType | undefined)}
              allLabel={t('transactions.filters.type')}
              ariaLabel={t('transactions.filters.typeAriaLabel')}
              options={typeOptions}
              icon={<FilterIcon />}
            />
            <FilterSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              allLabel={t('transactions.filters.category')}
              ariaLabel={t('transactions.filters.categoryAriaLabel')}
              options={categoryOptions}
            />
            <FilterSelect
              value={accountFilter}
              onChange={setAccountFilter}
              allLabel={t('transactions.filters.account')}
              ariaLabel={t('transactions.filters.accountAriaLabel')}
              options={accountOptions}
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="month-sort" className="text-[12.5px] text-muted-foreground">
              {t('transactions.sort.label')}
            </label>
            <select
              id="month-sort"
              className="h-8 rounded-md border bg-background px-2 text-[12.5px]"
              value={sort}
              onChange={(event) => setSort(event.target.value as TransactionSort)}
            >
              <option value={TransactionSort.newest}>{t('transactions.sort.newest')}</option>
              <option value={TransactionSort.oldest}>{t('transactions.sort.oldest')}</option>
              <option value={TransactionSort.amountHighest}>{t('transactions.sort.amountHighest')}</option>
              <option value={TransactionSort.amountLowest}>{t('transactions.sort.amountLowest')}</option>
              <option value={TransactionSort.description}>{t('transactions.sort.description')}</option>
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
        {!loading && !failed && !hasEntries && hasActiveFilters ? (
          <EmptyState
            icon={SearchIcon}
            title={t('transactions.filters.empty.title')}
            description={t('transactions.filters.empty.description')}
            action={
              <Button variant="outline" size="sm" onClick={clearFilters}>
                {t('transactions.filters.empty.clear')}
              </Button>
            }
          />
        ) : null}
        {!loading && !failed && !hasEntries && !hasActiveFilters ? (
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
                  <EntryMeta entry={entry} accountNames={accountNames} />
                  <div className="text-right">
                    <EntryAmount entry={entry} />
                  </div>
                  <div className="col-start-2 col-end-4 flex justify-self-end shell:col-auto shell:justify-self-auto">
                    {entry.status === TransactionStatus.DRAFT ? (
                      <Button
                        size="icon-xs"
                        aria-label={t('transactions.confirm')}
                        className="opacity-50 transition-opacity group-hover:opacity-100"
                        onClick={() => confirm.mutate({ id: entry.id, data: { status: TransactionStatus.CONFIRMED } })}
                        disabled={confirm.isPending}
                      >
                        <CheckIcon />
                      </Button>
                    ) : null}
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
