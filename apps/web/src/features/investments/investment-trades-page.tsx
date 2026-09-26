import {
  type InvestmentTradeDto,
  useCreateInvestmentTrade,
  useDeleteInvestmentTrade,
  useListAccounts,
  useListAssetListings,
  useListInstruments,
  useListInvestmentTrades,
  usePreviewInvestmentTradeRemoval,
  useUpdateInvestmentTrade,
} from '@family-budget/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { EyeIcon, PencilIcon, PlusIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/confirm-dialog';
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
import { formatCents, formatCentsInput, parseCurrencyInput } from '@/lib/money';

interface TradeValues {
  accountId: string;
  acquiredInstrumentId: string;
  acquiredQuantity: string;
  disposedInstrumentId: string;
  disposedQuantity: string;
  feeInstrumentId: string;
  feeQuantity: string;
  feeValue: string;
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
  feeInstrumentId: '',
  feeQuantity: '',
  feeValue: '',
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
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['/investment-trades'] });
    void client.invalidateQueries({ queryKey: ['/accounts/instrument-balances'] });
    void client.invalidateQueries({ queryKey: ['/investment-positions'] });
  };
  const closeForm = () => {
    setValues(emptyTrade());
    setEditing(null);
    setOpen(false);
  };
  const create = useCreateInvestmentTrade({
    mutation: {
      onSuccess: () => {
        invalidate();
        closeForm();
      },
    },
  });
  const update = useUpdateInvestmentTrade({
    mutation: {
      onSuccess: () => {
        invalidate();
        closeForm();
      },
    },
  });
  const remove = useDeleteInvestmentTrade({
    mutation: {
      onSuccess: () => {
        invalidate();
        setRemoving(null);
        setDetail(null);
      },
    },
  });
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<InvestmentTradeDto | null>(null);
  const [editing, setEditing] = useState<InvestmentTradeDto | null>(null);
  const [removing, setRemoving] = useState<InvestmentTradeDto | null>(null);
  const [values, setValues] = useState<TradeValues>(emptyTrade);
  const removalPreview = usePreviewInvestmentTradeRemoval(removing?.id ?? '', { query: { enabled: removing !== null } });
  const eligibleListings = (listings.data ?? []).filter((listing) => listing.instrumentId === values.acquiredInstrumentId);
  const mutation = editing ? update : create;

  const startNew = () => {
    setEditing(null);
    setValues(emptyTrade());
    setOpen(true);
  };
  const startEdit = (trade: InvestmentTradeDto) => {
    setEditing(trade);
    setValues({
      accountId: trade.accountId,
      acquiredInstrumentId: trade.acquiredInstrumentId,
      acquiredQuantity: trade.acquiredQuantity,
      disposedInstrumentId: trade.disposedInstrumentId,
      disposedQuantity: trade.disposedQuantity,
      feeInstrumentId: trade.feeInstrumentId ?? '',
      feeQuantity: trade.feeQuantity ?? '',
      feeValue: trade.feeValue == null ? '' : formatCentsInput(trade.feeValue),
      assetListingId: trade.assetListingId ?? 'none',
      executedAt: trade.executedAt.slice(0, 16),
      executionValue: formatCentsInput(trade.executionValue),
      notes: trade.notes ?? '',
    });
    setOpen(true);
  };

  const submit = () => {
    const executionValue = parseCurrencyInput(values.executionValue);
    const feeValue = parseCurrencyInput(values.feeValue);
    if (executionValue === null || (values.feeValue && feeValue === null)) return;
    const data = {
      accountId: values.accountId,
      acquiredInstrumentId: values.acquiredInstrumentId,
      acquiredQuantity: values.acquiredQuantity,
      disposedInstrumentId: values.disposedInstrumentId,
      disposedQuantity: values.disposedQuantity,
      ...(values.feeInstrumentId && values.feeQuantity && feeValue !== null
        ? { feeInstrumentId: values.feeInstrumentId, feeQuantity: values.feeQuantity, feeValue }
        : {}),
      ...(values.assetListingId === 'none' ? {} : { assetListingId: values.assetListingId }),
      executedAt: `${values.executedAt}:00.000Z`,
      executionValue,
      ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
    };
    if (editing) {
      update.mutate({
        id: editing.id,
        data: {
          ...data,
          feeInstrumentId: values.feeInstrumentId || null,
          feeQuantity: values.feeQuantity || null,
          feeValue: feeValue ?? null,
          assetListingId: values.assetListingId === 'none' ? null : values.assetListingId,
          notes: values.notes.trim() || null,
        },
      });
    } else create.mutate({ data });
  };

  return (
    <>
      <PageHeader
        title={t('investmentTrades.title')}
        actions={
          <Button size="sm" onClick={startNew}>
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
              action={<Button onClick={startNew}>{t('investmentTrades.new')}</Button>}
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
                      {!trade.isImported && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => startEdit(trade)}
                            aria-label={t('investmentTrades.edit', { trade: trade.acquiredInstrumentCode })}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setRemoving(trade)}
                            aria-label={t('investmentTrades.delete', { trade: trade.acquiredInstrumentCode })}
                          >
                            <Trash2Icon />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </PageContent>

      <Dialog open={open} onOpenChange={(next) => !mutation.isPending && (next ? setOpen(true) : closeForm())}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? t('investmentTrades.editTitle') : t('investmentTrades.new')}</DialogTitle>
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
              <InstrumentLeg
                id="fee"
                label={t('investmentTrades.fields.fee')}
                instrumentId={values.feeInstrumentId}
                quantity={values.feeQuantity}
                instruments={instruments.data ?? []}
                onChange={(field, value) => setValues({ ...values, [field]: value })}
              />
              <Field label={t('investmentTrades.fields.feeValue')}>
                <Input inputMode="decimal" value={values.feeValue} onChange={(event) => setValues({ ...values, feeValue: event.target.value })} />
              </Field>
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
            {mutation.error && (
              <p role="alert" className="text-sm text-destructive">
                {apiErrorMessage(mutation.error, t)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={
                mutation.isPending ||
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
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Detail label={t('investmentTrades.fields.account')} value={detail.accountName} />
                <Detail label={t('investmentTrades.fields.received')} value={`${detail.acquiredQuantity} ${detail.acquiredInstrumentCode}`} />
                <Detail label={t('investmentTrades.fields.delivered')} value={`${detail.disposedQuantity} ${detail.disposedInstrumentCode}`} />
                {detail.feeInstrumentCode && <Detail label={t('investmentTrades.fields.fee')} value={`${detail.feeQuantity} ${detail.feeInstrumentCode}`} />}
                {detail.feeValue != null && <Detail label={t('investmentTrades.fields.feeValue')} value={formatCents(detail.feeValue)} />}
                <Detail
                  label={t('investmentTrades.details.executionPrice')}
                  value={`${detail.executionPrice} ${detail.disposedInstrumentCode}/${detail.acquiredInstrumentCode}`}
                />
                <Detail label={t('investmentTrades.fields.executionTime')} value={formatExecution(detail.executedAt, i18n.language)} />
                <Detail label={t('investmentTrades.fields.executionValue')} value={formatCents(detail.executionValue)} />
                <Detail label={t('investmentTrades.fields.listing')} value={detail.assetListing ?? '—'} />
                <Detail label={t('investmentTrades.fields.notes')} value={detail.notes ?? '—'} />
              </dl>
              {!detail.isImported && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => startEdit(detail)}>
                    {t('common.edit')}
                  </Button>
                  <Button variant="destructive" onClick={() => setRemoving(detail)}>
                    {t('common.delete')}
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
        title={t('investmentTrades.remove.title')}
        description={
          removalPreview.isPending
            ? t('investmentTrades.remove.loading')
            : removalPreview.isError
              ? t('investmentTrades.remove.error')
              : removalPreview.data && (
                  <div className="grid gap-2">
                    <p>{t('investmentTrades.remove.description', { count: removalPreview.data.laterTrades.length })}</p>
                    <p className="text-xs text-muted-foreground">{t('investmentTrades.remove.projectedBalances')}</p>
                    <ul className="grid gap-1 text-sm tabular-nums">
                      {removalPreview.data.projectedBalances.map((balance) => (
                        <li key={`${balance.accountId}:${balance.instrumentId}`}>
                          {balance.instrumentCode}: {formatQuantity(balance.quantity, i18n.language)}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">{t('investmentTrades.remove.projectedPositions')}</p>
                    <ul className="grid gap-1 text-sm tabular-nums">
                      {removalPreview.data.projectedPositions
                        .filter((position) => position.accountId !== null)
                        .map((position) => (
                          <li key={`${position.accountId}:${position.instrumentId}`}>
                            {position.accountName} · {position.instrumentCode}: {formatQuantity(position.quantity, i18n.language)} ·{' '}
                            {formatCents(position.remainingCost)} · {formatCents(position.realizedResult)} ·{' '}
                            {position.unrealizedResult == null ? '—' : formatCents(position.unrealizedResult)}
                          </li>
                        ))}
                    </ul>
                  </div>
                )
        }
        confirmLabel={t('investmentTrades.remove.confirm')}
        variant="destructive"
        isPending={remove.isPending || removalPreview.isPending}
        onConfirm={() => {
          if (removing && removalPreview.data) remove.mutate({ id: removing.id });
          else void removalPreview.refetch();
        }}
      />
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
  id: 'acquired' | 'disposed' | 'fee';
  label: string;
  instrumentId: string;
  quantity: string;
  instruments: { id: string; code: string }[];
  onChange: (field: keyof TradeValues, value: string) => void;
}) {
  const instrumentField = id === 'acquired' ? 'acquiredInstrumentId' : id === 'disposed' ? 'disposedInstrumentId' : 'feeInstrumentId';
  const quantityField = id === 'acquired' ? 'acquiredQuantity' : id === 'disposed' ? 'disposedQuantity' : 'feeQuantity';
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
