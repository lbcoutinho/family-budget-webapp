import {
  type InvestmentTradeDto,
  useCreateInvestmentTrade,
  useListAccounts,
  useListAssetListings,
  useListInstruments,
  useListInvestmentTrades,
} from '@family-budget/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { EyeIcon, PlusIcon, TriangleAlertIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import { formatCents, parseCurrencyInput } from '@/lib/money';

interface TradeValues {
  accountId: string;
  acquiredInstrumentId: string;
  acquiredQuantity: string;
  disposedInstrumentId: string;
  disposedQuantity: string;
  assetListingId: string;
  executedAt: string;
  executionValue: string;
  notes: string;
}

const emptyTrade = (): TradeValues => ({
  accountId: '',
  acquiredInstrumentId: '',
  acquiredQuantity: '',
  disposedInstrumentId: '',
  disposedQuantity: '',
  assetListingId: 'none',
  executedAt: new Date().toISOString().slice(0, 16),
  executionValue: '',
  notes: '',
});

export function InvestmentTradesPage() {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const trades = useListInvestmentTrades();
  const accounts = useListAccounts();
  const instruments = useListInstruments();
  const listings = useListAssetListings();
  const create = useCreateInvestmentTrade({
    mutation: {
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: ['/investment-trades'] });
        void client.invalidateQueries({ queryKey: ['/accounts/instrument-balances'] });
        setValues(emptyTrade());
        setOpen(false);
      },
    },
  });
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<InvestmentTradeDto | null>(null);
  const [values, setValues] = useState<TradeValues>(emptyTrade);
  const eligibleListings = (listings.data ?? []).filter((listing) => listing.instrumentId === values.acquiredInstrumentId);

  const submit = () => {
    const executionValue = parseCurrencyInput(values.executionValue);
    if (executionValue === null) return;
    create.mutate({
      data: {
        accountId: values.accountId,
        acquiredInstrumentId: values.acquiredInstrumentId,
        acquiredQuantity: values.acquiredQuantity,
        disposedInstrumentId: values.disposedInstrumentId,
        disposedQuantity: values.disposedQuantity,
        ...(values.assetListingId === 'none' ? {} : { assetListingId: values.assetListingId }),
        executedAt: `${values.executedAt}:00.000Z`,
        executionValue,
        ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
      },
    });
  };

  return (
    <>
      <PageHeader
        title={t('investmentTrades.title')}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <PlusIcon />
            {t('investmentTrades.new')}
          </Button>
        }
      />
      <PageContent>
        <p className="mb-4 text-sm text-muted-foreground">{t('investmentTrades.description')}</p>
        <Card className="py-0">
          {trades.isPending && <div className="p-6 text-sm text-muted-foreground">{t('common.loading')}</div>}
          {trades.isError && (
            <EmptyState
              icon={TriangleAlertIcon}
              title={t('investmentTrades.error.title')}
              description={t('investmentTrades.error.description')}
              action={<Button onClick={() => void trades.refetch()}>{t('common.retry')}</Button>}
            />
          )}
          {!trades.isPending && !trades.isError && trades.data?.length === 0 && (
            <EmptyState
              icon={PlusIcon}
              title={t('investmentTrades.empty.title')}
              description={t('investmentTrades.empty.description')}
              action={<Button onClick={() => setOpen(true)}>{t('investmentTrades.new')}</Button>}
            />
          )}
          {!trades.isPending && !trades.isError && (trades.data?.length ?? 0) > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('investmentTrades.columns.execution')}</TableHead>
                  <TableHead>{t('investmentTrades.columns.account')}</TableHead>
                  <TableHead>{t('investmentTrades.columns.received')}</TableHead>
                  <TableHead>{t('investmentTrades.columns.delivered')}</TableHead>
                  <TableHead className="text-right">{t('investmentTrades.columns.value')}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t('common.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.data?.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatExecution(trade.executedAt, i18n.language)}</TableCell>
                    <TableCell>{trade.accountName}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatQuantity(trade.acquiredQuantity, i18n.language)} {trade.acquiredInstrumentCode}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatQuantity(trade.disposedQuantity, i18n.language)} {trade.disposedInstrumentCode}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(trade.executionValue)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDetail(trade)}
                        aria-label={t('investmentTrades.view', { trade: trade.acquiredInstrumentCode })}
                      >
                        <EyeIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </PageContent>

      <Dialog open={open} onOpenChange={(next) => !create.isPending && setOpen(next)}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('investmentTrades.new')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label={t('investmentTrades.fields.account')}>
              <Select value={values.accountId} onValueChange={(accountId) => setValues({ ...values, accountId })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('investmentTrades.fields.choose')} />
                </SelectTrigger>
                <SelectContent>
                  {(accounts.data ?? []).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <InstrumentLeg
                id="acquired"
                label={t('investmentTrades.fields.received')}
                instrumentId={values.acquiredInstrumentId}
                quantity={values.acquiredQuantity}
                instruments={instruments.data ?? []}
                onChange={(field, value) => setValues({ ...values, [field]: value })}
              />
              <InstrumentLeg
                id="disposed"
                label={t('investmentTrades.fields.delivered')}
                instrumentId={values.disposedInstrumentId}
                quantity={values.disposedQuantity}
                instruments={instruments.data ?? []}
                onChange={(field, value) => setValues({ ...values, [field]: value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('investmentTrades.fields.executionTime')}>
                <Input type="datetime-local" value={values.executedAt} onChange={(event) => setValues({ ...values, executedAt: event.target.value })} />
              </Field>
              <Field label={t('investmentTrades.fields.executionValue')}>
                <Input inputMode="decimal" value={values.executionValue} onChange={(event) => setValues({ ...values, executionValue: event.target.value })} />
              </Field>
            </div>
            <Field label={t('investmentTrades.fields.listing')}>
              <Select value={values.assetListingId} onValueChange={(assetListingId) => setValues({ ...values, assetListingId })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('investmentTrades.fields.noListing')}</SelectItem>
                  {eligibleListings.map((listing) => (
                    <SelectItem key={listing.id} value={listing.id}>
                      {listing.ticker} · {listing.market}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('investmentTrades.fields.notes')}>
              <Input value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} />
            </Field>
            {create.error && (
              <p role="alert" className="text-sm text-destructive">
                {apiErrorMessage(create.error, t)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={
                create.isPending ||
                !values.accountId ||
                !values.acquiredInstrumentId ||
                !values.acquiredQuantity ||
                !values.disposedInstrumentId ||
                !values.disposedQuantity ||
                !values.executedAt ||
                !values.executionValue
              }
              onClick={submit}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detail !== null} onOpenChange={(next) => !next && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('investmentTrades.details.title')}</DialogTitle>
          </DialogHeader>
          {detail && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Detail label={t('investmentTrades.fields.account')} value={detail.accountName} />
              <Detail label={t('investmentTrades.fields.received')} value={`${detail.acquiredQuantity} ${detail.acquiredInstrumentCode}`} />
              <Detail label={t('investmentTrades.fields.delivered')} value={`${detail.disposedQuantity} ${detail.disposedInstrumentCode}`} />
              <Detail
                label={t('investmentTrades.details.executionPrice')}
                value={`${detail.executionPrice} ${detail.disposedInstrumentCode}/${detail.acquiredInstrumentCode}`}
              />
              <Detail label={t('investmentTrades.fields.executionTime')} value={formatExecution(detail.executedAt, i18n.language)} />
              <Detail label={t('investmentTrades.fields.executionValue')} value={formatCents(detail.executionValue)} />
              <Detail label={t('investmentTrades.fields.listing')} value={detail.assetListing ?? '—'} />
              <Detail label={t('investmentTrades.fields.notes')} value={detail.notes ?? '—'} />
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words tabular-nums">{value}</dd>
    </div>
  );
}
function InstrumentLeg({
  id,
  label,
  instrumentId,
  quantity,
  instruments,
  onChange,
}: {
  id: 'acquired' | 'disposed';
  label: string;
  instrumentId: string;
  quantity: string;
  instruments: { id: string; code: string }[];
  onChange: (field: keyof TradeValues, value: string) => void;
}) {
  const instrumentField = id === 'acquired' ? 'acquiredInstrumentId' : 'disposedInstrumentId';
  const quantityField = id === 'acquired' ? 'acquiredQuantity' : 'disposedQuantity';
  return (
    <div className="grid gap-1.5 rounded-md border p-3">
      <Label>{label}</Label>
      <Select value={instrumentId} onValueChange={(value) => onChange(instrumentField, value)}>
        <SelectTrigger>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {instruments.map((instrument) => (
            <SelectItem key={instrument.id} value={instrument.id}>
              {instrument.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input inputMode="decimal" value={quantity} onChange={(event) => onChange(quantityField, event.target.value)} />
    </div>
  );
}

function formatQuantity(value: string, locale: string): string {
  const [whole, fraction = ''] = value.split('.');
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.';
  return `${new Intl.NumberFormat(locale).format(BigInt(whole ?? '0'))}${separator}${fraction.padEnd(4, '0').slice(0, 4)}`;
}

function formatExecution(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Lisbon',
  }).format(new Date(value));
}
