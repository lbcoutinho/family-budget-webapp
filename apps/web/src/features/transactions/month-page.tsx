import { getListTransactionsQueryOptions, listTransactions, type TransactionListItemDto, TransactionStatus, TransactionType } from '@family-budget/api-client';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, CreditCardIcon, SearchIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/empty-state';
import { PageContent, PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import i18n from '@/i18n';
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

function transactionAmount(transaction: TransactionListItemDto): number {
  if (transaction.type === TransactionType.EXPENSE || transaction.type === TransactionType.CASHBOX_IN) return -transaction.amount;
  if (transaction.type === TransactionType.INCOME || transaction.type === TransactionType.CASHBOX_OUT) return transaction.amount;

  return transaction.amount;
}

function typeLabel(type: TransactionType, t: (key: string) => string): string {
  return t(`transactions.type.${type}`);
}

function transactionDetail(transaction: TransactionListItemDto): string {
  const category = [transaction.category?.name, transaction.subcategory?.name].filter(Boolean).join(' · ');
  const account = transaction.account?.name;
  const cashbox = transaction.cashboxLabel ?? transaction.destinationCashboxLabel;

  return [category, account, cashbox].filter(Boolean).join(' — ');
}

function typeBadgeClass(type: TransactionType): string {
  if (type === TransactionType.INCOME) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (type === TransactionType.EXPENSE) return 'border-red-200 bg-red-50 text-red-800';
  if (type === TransactionType.TRANSFER) return 'border-blue-200 bg-blue-50 text-blue-800';

  return 'border-amber-200 bg-amber-50 text-amber-900';
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
        className="h-auto px-1 text-[1.05rem] font-bold tracking-[-0.02em]"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {formatMonth(month)}
        <ChevronRightIcon className="size-4" />
      </Button>
      {open ? (
        <div
          role="dialog"
          aria-label={t('transactions.monthPicker')}
          className="absolute top-full left-0 z-30 mt-2 w-72 rounded-lg border bg-popover p-3 shadow-md"
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
        <span className="truncate font-medium">{entry.description}</span>
        {entry.isCreditCard ? <CreditCardIcon aria-label={t('transactions.creditCard')} className="size-3.5 shrink-0 text-muted-foreground" /> : null}
        {entry.status === TransactionStatus.DRAFT ? (
          <Badge variant="outline" className="border-dashed text-[10px]">
            {t('transactions.draft')}
          </Badge>
        ) : null}
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">
        {detail || typeLabel(entry.type, t)}
        {entry.isCreditCard ? ` · ${t('transactions.purchaseOn', { date: new Intl.DateTimeFormat(i18n.language).format(localDate(entry.date)) })}` : ''}
      </p>
    </div>
  );
}

function EntryAmount({ entry }: { entry: TransactionListItemDto }) {
  const neutral = entry.type === TransactionType.TRANSFER || entry.type === TransactionType.CASHBOX_TRANSFER;
  const amount = neutral ? entry.amount : transactionAmount(entry);
  const tone = amount < 0 ? 'text-destructive' : amount > 0 ? 'text-emerald-700' : '';

  return <span className={`num whitespace-nowrap ${tone}`}>{formatCents(amount, { sign: !neutral })}</span>;
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
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);

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
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table exposes non-memoizable functions by design.
  const table = useReactTable({
    data: allEntries,
    columns: [
      {
        accessorKey: 'date',
        header: t('transactions.columns.date'),
        cell: ({ row }) => new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: 'short' }).format(localDate(row.original.date)),
      },
      { accessorKey: 'description', header: t('transactions.columns.description'), cell: ({ row }) => <EntryMeta entry={row.original} /> },
      {
        accessorKey: 'type',
        header: t('transactions.columns.type'),
        cell: ({ row }) => (
          <Badge variant="outline" className={typeBadgeClass(row.original.type)}>
            {typeLabel(row.original.type, t)}
          </Badge>
        ),
      },
      { accessorKey: 'amount', header: t('transactions.columns.amount'), cell: ({ row }) => <EntryAmount entry={row.original} /> },
    ],
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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
        title={<MonthPicker key={referenceMonth.toISOString()} month={referenceMonth} onSelect={selectMonth} />}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={t('transactions.previousMonth')} onClick={() => moveMonth(-1)}>
              <ChevronLeftIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={t('transactions.nextMonth')} onClick={() => moveMonth(1)}>
              <ChevronRightIcon />
            </Button>
            <Button variant="outline" size="sm" onClick={() => selectMonth(new Date())}>
              {t('transactions.today')}
            </Button>
          </div>
        }
      />
      <PageContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t('transactions.title')}</h2>
            {!loading && !failed ? (
              <p className="text-sm text-muted-foreground">
                {t('transactions.count', { count: firstPage?.total ?? 0 })} · {t('transactions.draftCount', { count: drafts.data?.total ?? 0 })}
              </p>
            ) : null}
          </div>
          <div className="relative w-full sm:w-60">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label={t('transactions.search')}
              placeholder={t('transactions.search')}
              className="pl-8"
            />
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
              <Button size="sm" disabled>
                {t('transactions.new')}
              </Button>
            }
          />
        ) : null}
        {!loading && !failed && hasEntries ? (
          <section aria-labelledby="month-entries" className="overflow-hidden rounded-lg border">
            <div className="border-b px-3 py-3">
              <h2 id="month-entries" className="font-semibold">
                {t('transactions.entries')}
              </h2>
            </div>
            <div className="hidden shell:block">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className={header.id === 'amount' ? 'text-right' : ''}>
                          {header.isPlaceholder ? null : (
                            <button type="button" className="cursor-pointer" onClick={header.column.getToggleSortingHandler()}>
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </button>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                {/* ponytail: client-side sorting only orders the loaded prefix; add API sorting if this ever becomes limiting. */}
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className={row.original.status === TransactionStatus.DRAFT ? 'opacity-55' : ''}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cell.column.id === 'amount' ? 'text-right' : ''}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>{t('transactions.income')}</TableCell>
                    <TableCell className="text-right">
                      <span className="num text-emerald-700">{formatCents(firstPage?.incomeTotal ?? 0, { sign: true })}</span>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3}>{t('transactions.expense')}</TableCell>
                    <TableCell className="text-right">
                      <span className="num text-destructive">{formatCents(-(firstPage?.expenseTotal ?? 0), { sign: true })}</span>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3}>{t('transactions.monthNet')}</TableCell>
                    <TableCell className="text-right">
                      <span className="num">{formatCents((firstPage?.incomeTotal ?? 0) - (firstPage?.expenseTotal ?? 0), { sign: true })}</span>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            <div className="shell:hidden divide-y">
              {allEntries.map((entry) => (
                <article key={entry.id} className={`flex gap-3 p-3 ${entry.status === TransactionStatus.DRAFT ? 'opacity-55' : ''}`}>
                  <time className="num shrink-0 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: 'short' }).format(localDate(entry.date))}
                  </time>
                  <EntryMeta entry={entry} />
                  <div className="ml-auto">
                    <EntryAmount entry={entry} />
                  </div>
                </article>
              ))}
            </div>
            <div className="border-t bg-muted/40 px-3 py-3 text-sm shell:hidden">
              <div className="flex justify-between">
                <span>{t('transactions.income')}</span>
                <span className="num text-emerald-700">{formatCents(firstPage?.incomeTotal ?? 0, { sign: true })}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>{t('transactions.expense')}</span>
                <span className="num text-destructive">{formatCents(-(firstPage?.expenseTotal ?? 0), { sign: true })}</span>
              </div>
              <div className="mt-1 flex justify-between font-medium">
                <span>{t('transactions.monthNet')}</span>
                <span className="num">{formatCents((firstPage?.incomeTotal ?? 0) - (firstPage?.expenseTotal ?? 0), { sign: true })}</span>
              </div>
            </div>
          </section>
        ) : null}
        <div ref={sentinel} className="flex justify-center" aria-hidden={!confirmed.hasNextPage}>
          {confirmed.hasNextPage ? (
            <Button variant="outline" size="sm" onClick={() => void confirmed.fetchNextPage()} disabled={confirmed.isFetchingNextPage}>
              {confirmed.isFetchingNextPage ? t('transactions.loadingMore') : t('transactions.loadMore')}
            </Button>
          ) : null}
        </div>
      </PageContent>
    </>
  );
}
