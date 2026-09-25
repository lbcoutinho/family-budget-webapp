import {
  type AccountDto,
  type AssetListingDto,
  type InvestmentPositionDto,
  useCreateMarketQuote,
  useListAccounts,
  useListAssetListings,
  useListInvestmentPositions,
} from '@family-budget/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { type TFunction } from 'i18next';
import { SlidersHorizontalIcon, TriangleAlertIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { toast } from 'sonner';

import { EmptyState } from '@/components/empty-state';
import { PageContent, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiErrorMessage } from '@/lib/api-error';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

const all = 'all';

export function InvestmentsOverviewPage() {
  const { t, i18n } = useTranslation();
  const positions = useListInvestmentPositions();
  const accounts = useListAccounts({ includeInactive: true });
  const listings = useListAssetListings();
  const queryClient = useQueryClient();
  const createQuote = useCreateMarketQuote({ mutation: { onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['/investment-positions'] }) } });
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [type, setType] = useState(all);
  const [institution, setInstitution] = useState(all);
  const [account, setAccount] = useState(all);
  const accountById = useMemo(() => new Map((accounts.data ?? []).map((item) => [item.id, item])), [accounts.data]);
  const accountPositions = (positions.data ?? []).filter((position) => position.accountId !== null);
  const filtered = accountPositions.filter((position) => matches(position, accountById, type, institution, account));
  const groups = (positions.data ?? [])
    .filter((position) => position.accountId === null)
    .map((position) => ({ position, accounts: filtered.filter((child) => child.instrumentId === position.instrumentId) }))
    .filter((group) => group.accounts.length > 0);
  const remainingCost = filtered.reduce((sum, position) => sum + position.remainingCost, 0);
  const realizedResult = filtered.reduce((sum, position) => sum + position.realizedResult, 0);
  const currentValue = filtered.every((position) => position.currentValue != null) ? filtered.reduce((sum, position) => sum + position.currentValue!, 0) : null;
  const unrealizedResult = filtered.every((position) => position.unrealizedResult != null)
    ? filtered.reduce((sum, position) => sum + position.unrealizedResult!, 0)
    : null;

  return (
    <>
      <PageHeader
        title={t('investmentOverview.title')}
        actions={
          <Button size="sm" onClick={() => setQuoteOpen(true)}>
            {t('investmentOverview.recordQuote')}
          </Button>
        }
      />
      <PageContent className="space-y-4">
        <nav className="flex gap-1 overflow-x-auto border-b" aria-label={t('investmentOverview.sections')}>
          <NavLink to="/investments/overview" className="border-b-2 border-foreground px-3 py-2 text-sm font-medium">
            {t('investmentOverview.title')}
          </NavLink>
          <NavLink to="/investments/operations" className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground">
            {t('investmentTrades.title')}
          </NavLink>
        </nav>
        <p className="text-sm text-muted-foreground">{t('investmentOverview.description')}</p>
        <div className="flex justify-end">
          <details className="group relative">
            <summary className="flex h-8 cursor-pointer list-none items-center gap-2 rounded-md border px-3 text-sm [&::-webkit-details-marker]:hidden">
              <SlidersHorizontalIcon className="size-4" />
              {t('investmentOverview.filters')}
            </summary>
            <div className="absolute right-0 z-10 mt-2 hidden w-72 gap-3 rounded-md border bg-card p-3 shadow-md group-open:grid">
              <Filter label={t('investmentOverview.type')} value={type} onChange={setType} options={instrumentTypes(t)} />
              <Filter label={t('investmentOverview.institution')} value={institution} onChange={setInstitution} options={institutions(accounts.data ?? [])} />
              <Filter
                label={t('investmentOverview.account')}
                value={account}
                onChange={setAccount}
                options={(accounts.data ?? []).map((item) => [item.id, item.name])}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setType(all);
                  setInstitution(all);
                  setAccount(all);
                }}
              >
                {t('investmentOverview.clearFilters')}
              </Button>
            </div>
          </details>
        </div>
        <section className="grid grid-cols-2 overflow-hidden rounded-lg border sm:grid-cols-4">
          <Metric label={t('investmentOverview.metrics.currentValue')} value={currentValue == null ? '—' : formatCents(currentValue)} />
          <Metric label={t('investmentOverview.metrics.remainingCost')} value={formatCents(remainingCost)} />
          <Metric label={t('investmentOverview.metrics.realized')} value={formatCents(realizedResult)} tone={realizedResult} />
          <Metric
            label={t('investmentOverview.metrics.unrealized')}
            value={unrealizedResult == null ? '—' : formatCents(unrealizedResult)}
            tone={unrealizedResult ?? undefined}
          />
        </section>
        <Card className="py-0">
          {positions.isPending && <div className="p-6 text-sm text-muted-foreground">{t('common.loading')}</div>}
          {positions.isError && (
            <EmptyState
              icon={TriangleAlertIcon}
              title={t('investmentOverview.error.title')}
              description={t('investmentOverview.error.description')}
              action={<Button onClick={() => void positions.refetch()}>{t('common.retry')}</Button>}
            />
          )}
          {!positions.isPending && !positions.isError && groups.length === 0 && (
            <EmptyState icon={SlidersHorizontalIcon} title={t('investmentOverview.empty.title')} description={t('investmentOverview.empty.description')} />
          )}
          {!positions.isPending && !positions.isError && groups.length > 0 && (
            <Table className="min-w-full text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-card">{t('investmentOverview.columns.instrument')}</TableHead>
                  <TableHead>{t('investmentOverview.columns.account')}</TableHead>
                  <TableHead className="text-right">{t('investmentOverview.columns.quantity')}</TableHead>
                  <TableHead className="text-right">{t('investmentOverview.columns.remainingCost')}</TableHead>
                  <TableHead className="text-right">{t('investmentOverview.columns.average')}</TableHead>
                  <TableHead>{t('investmentOverview.columns.quote')}</TableHead>
                  <TableHead className="text-right">{t('investmentOverview.columns.currentValue')}</TableHead>
                  <TableHead className="text-right">{t('investmentOverview.columns.realized')}</TableHead>
                  <TableHead className="text-right">{t('investmentOverview.columns.unrealized')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.flatMap(({ position, accounts: children }) => [
                  <PositionRow key={position.instrumentId} position={position} parent locale={i18n.language} t={t} />,
                  ...children.map((child) => <PositionRow key={child.accountId} position={child} locale={i18n.language} t={t} />),
                ])}
              </TableBody>
            </Table>
          )}
        </Card>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label={t('investmentOverview.quoteStates')}>
          <QuoteLegend className="bg-income" label={t('investmentOverview.quoteCurrent')} />
          <QuoteLegend className="bg-amber-600" label={t('investmentOverview.quoteStale')} />
          <QuoteLegend className="bg-blue-600" label={t('investmentOverview.quoteManual')} />
          <QuoteLegend className="border border-destructive" label={t('investmentOverview.quoteMissing')} />
        </div>
      </PageContent>
      <QuoteDialog open={quoteOpen} onOpenChange={setQuoteOpen} listings={listings.data ?? []} onCreate={(data) => createQuote.mutateAsync({ data })} />
    </>
  );
}

function QuoteDialog({
  open,
  onOpenChange,
  listings,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listings: AssetListingDto[];
  onCreate: (data: { assetListingId: string; price: string; marketDate: string }) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [assetListingId, setAssetListingId] = useState('');
  const [price, setPrice] = useState('');
  const [marketDate, setMarketDate] = useState(() => new Date().toISOString().slice(0, 10));
  const activeListings = listings.filter((listing) => listing.isActive);
  const selected = activeListings.find((listing) => listing.id === assetListingId) ?? activeListings[0];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('investmentOverview.recordQuote')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm">
            <span>{t('investmentOverview.quoteListing')}</span>
            <Select value={selected?.id ?? ''} onValueChange={setAssetListingId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeListings.map((listing) => (
                  <SelectItem key={listing.id} value={listing.id}>
                    {listing.instrumentName} · {listing.ticker} ({listing.quoteInstrumentCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="grid gap-2">
            <Label htmlFor="quote-price">{t('investmentOverview.quotePrice', { instrument: selected?.quoteInstrumentCode ?? '—' })}</Label>
            <Input id="quote-price" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quote-date">{t('investmentOverview.quoteDate')}</Label>
            <Input id="quote-date" type="date" value={marketDate} onChange={(event) => setMarketDate(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!selected || !price || !marketDate}
            onClick={() =>
              void onCreate({ assetListingId: selected!.id, price, marketDate })
                .then(() => onOpenChange(false))
                .catch((error: unknown) => toast.error(apiErrorMessage(error, t)))
            }
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={all}>—</SelectItem>
          {options.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="border-b p-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong
        className={cn('block mt-1 font-display text-xl tabular-nums', tone !== undefined && tone !== 0 && (tone > 0 ? 'text-income' : 'text-destructive'))}
      >
        {value}
      </strong>
    </div>
  );
}

function QuoteLegend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i aria-hidden className={cn('size-2 rounded-full', className)} />
      {label}
    </span>
  );
}

function PositionRow({ position, parent = false, locale, t }: { position: InvestmentPositionDto; parent?: boolean; locale: string; t: TFunction }) {
  return (
    <TableRow className={cn(parent && 'bg-muted/50 hover:bg-muted/50', position.quantity === '0' && 'text-muted-foreground')}>
      <TableCell className={cn('sticky left-0 z-10 bg-card font-medium', parent && 'bg-muted/50')}>
        {parent ? (
          <>
            {position.instrumentName}
            <span className="ml-1 text-muted-foreground">{position.instrumentCode}</span>
          </>
        ) : (
          '↳'
        )}
      </TableCell>
      <TableCell>{parent ? t('investmentOverview.consolidated') : position.accountName}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatQuantity(position.quantity, position.displayPrecision, locale)} {position.instrumentCode}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatCents(position.remainingCost)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatDecimal(position.weightedAverageCost, locale)} €</TableCell>
      <TableCell>{parent ? <QuoteStatus position={position} t={t} /> : <span className="sr-only">{t('investmentOverview.quoteShared')}</span>}</TableCell>
      <TableCell className="text-right tabular-nums">{position.currentValue == null ? '—' : formatCents(position.currentValue)}</TableCell>
      <TableCell className={cn('text-right tabular-nums', position.realizedResult > 0 ? 'text-income' : position.realizedResult < 0 && 'text-destructive')}>
        {formatCents(position.realizedResult)}
      </TableCell>
      <TableCell
        className={cn(
          'text-right tabular-nums',
          position.unrealizedResult && position.unrealizedResult > 0
            ? 'text-income'
            : position.unrealizedResult && position.unrealizedResult < 0 && 'text-destructive',
        )}
      >
        {position.unrealizedResult == null ? '—' : formatCents(position.unrealizedResult)}
      </TableCell>
    </TableRow>
  );
}

function QuoteStatus({ position, t }: { position: InvestmentPositionDto; t: TFunction }) {
  if (position.quantity === '0') return <span className="text-muted-foreground">{t('investmentOverview.quoteClosed')}</span>;
  if (position.quoteStatus === 'MISSING' || position.quoteStatus === 'ERROR')
    return (
      <span className="inline-flex items-center gap-1.5 text-destructive">
        <i aria-hidden className="size-2 rounded-full border border-destructive" />
        {position.quoteStatus === 'ERROR' ? t('investmentOverview.quoteError') : t('investmentOverview.quoteMissing')}
      </span>
    );
  return (
    <span className={cn('inline-flex items-center gap-1.5', position.quoteStatus === 'STALE' ? 'text-amber-600' : 'text-blue-600')}>
      <i aria-hidden className="size-2 rounded-full bg-current" />
      {position.quoteStatus === 'STALE'
        ? t('investmentOverview.quoteStale')
        : position.quoteStatus === 'PROVIDER'
          ? t('investmentOverview.quoteProvider')
          : t('investmentOverview.quoteManual')}
      : {position.quotePrice} {position.quoteInstrumentCode} · {position.quoteMarketDate}
    </span>
  );
}

function matches(position: InvestmentPositionDto, accounts: Map<string, AccountDto>, type: string, institution: string, account: string): boolean {
  const row = accounts.get(position.accountId!);
  return (
    (type === all || position.instrumentType === type) &&
    (institution === all || row?.financialInstitutionId === institution) &&
    (account === all || position.accountId === account)
  );
}

function instrumentTypes(t: TFunction): [string, string][] {
  return (['CRYPTOCURRENCY', 'STOCK', 'ETF', 'ETC'] as const).map((type) => [type, t(`investmentSetup.instrumentTypes.${type}`)]);
}

function institutions(accounts: AccountDto[]): [string, string][] {
  return [
    ...new Map(
      accounts.flatMap((account) =>
        account.financialInstitutionId && account.financialInstitutionName
          ? [[account.financialInstitutionId, account.financialInstitutionName] as [string, string]]
          : [],
      ),
    ).entries(),
  ];
}

function formatQuantity(value: string, precision: number, locale: string): string {
  return formatDecimal(value, locale, precision);
}

function formatDecimal(value: string, locale: string, maximumFractionDigits = 4): string {
  const [whole, fraction = ''] = value.split('.');
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.';
  return `${new Intl.NumberFormat(locale).format(BigInt(whole ?? '0'))}${separator}${fraction.padEnd(maximumFractionDigits, '0').slice(0, maximumFractionDigits)}`;
}
