import {
  type AssetListingDto,
  type FinancialInstitutionDto,
  type InstrumentDto,
  useActivateAssetListing,
  useActivateFinancialInstitution,
  useActivateInstrument,
  useCreateAssetListing,
  useCreateFinancialInstitution,
  useCreateInstrument,
  useDeactivateAssetListing,
  useDeactivateFinancialInstitution,
  useDeactivateInstrument,
  useListAssetListings,
  useListFinancialInstitutions,
  useListInstruments,
  useUpdateAssetListing,
  useUpdateFinancialInstitution,
  useUpdateInstrument,
} from '@family-budget/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { PlusIcon, TriangleAlertIcon } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Resource<T, V> {
  title: string;
  description: string;
  empty: string;
  columns: string[];
  list: T[];
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
  values: () => V;
  fields: (values: V, setValues: (values: V) => void) => ReactNode;
  toValues: (item: T) => V;
  cells: (item: T) => ReactNode;
  create: (values: V) => void;
  update: (id: string, values: V) => void;
  activate: (id: string) => void;
  deactivate: (id: string) => void;
}

interface ActiveRow {
  id: string;
  isActive: boolean;
}

function Registry<T extends ActiveRow, V>({ resource }: { resource: Resource<T, V> }) {
  const { t } = useTranslation();
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const [retiring, setRetiring] = useState<T | null>(null);
  const [values, setValues] = useState<V>(resource.values);
  const rows = showInactive ? resource.list : resource.list.filter((item) => item.isActive);
  const open = (item: T | 'new') => {
    setValues(item === 'new' ? resource.values() : resource.toValues(item));
    setEditing(item);
  };

  return (
    <>
      <PageHeader
        title={resource.title}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} aria-label={t('investmentSetup.showInactive')} />
              {t('investmentSetup.showInactive')}
            </label>
            <Button size="sm" onClick={() => open('new')}>
              <PlusIcon />
              {t('investmentSetup.new')}
            </Button>
          </>
        }
      />
      <PageContent>
        <p className="mb-4 text-sm text-muted-foreground">{resource.description}</p>
        <Card className="py-0">
          {resource.isPending && <div className="p-6">{t('common.loading')}</div>}
          {resource.isError && (
            <EmptyState
              icon={TriangleAlertIcon}
              title={t('investmentSetup.error.title')}
              description={t('investmentSetup.error.description')}
              action={<Button onClick={resource.refetch}>{t('common.retry')}</Button>}
            />
          )}
          {!resource.isPending && !resource.isError && rows.length === 0 && (
            <EmptyState
              icon={PlusIcon}
              title={resource.empty}
              description={resource.description}
              action={
                <Button onClick={() => open('new')}>
                  <PlusIcon />
                  {t('investmentSetup.new')}
                </Button>
              }
            />
          )}
          {!resource.isPending && !resource.isError && rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  {resource.columns.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                  <TableHead>{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => (
                  <TableRow key={item.id} className={!item.isActive ? 'opacity-60' : undefined}>
                    {resource.cells(item)}
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => open(item)}>
                        {t('common.edit')}
                      </Button>
                      {item.isActive ? (
                        <Button variant="ghost" size="sm" onClick={() => setRetiring(item)}>
                          {t('investmentSetup.deactivate')}
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => resource.activate(item.id)}>
                          {t('investmentSetup.activate')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </PageContent>
      <Dialog open={editing !== null} onOpenChange={(openDialog) => !openDialog && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? t('investmentSetup.createTitle', { resource: resource.title }) : t('investmentSetup.editTitle')}</DialogTitle>
          </DialogHeader>
          {resource.fields(values, setValues)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (editing === 'new') resource.create(values);
                else if (editing) resource.update(editing.id, values);
                setEditing(null);
              }}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={retiring !== null}
        onOpenChange={(openDialog) => !openDialog && setRetiring(null)}
        title={t('investmentSetup.deactivateTitle', { resource: resource.title })}
        description={t('investmentSetup.deactivateDescription')}
        confirmLabel={t('investmentSetup.deactivate')}
        onConfirm={() => {
          if (retiring) resource.deactivate(retiring.id);
          setRetiring(null);
        }}
      />
    </>
  );
}

const textField = (id: string, label: string, value: string, setValue: (value: string) => void) => (
  <div className="grid gap-2">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} value={value} onChange={(event) => setValue(event.target.value)} />
  </div>
);

export function FinancialInstitutionsPage() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const query = useListFinancialInstitutions({ includeInactive: true });
  const invalidate = () => void client.invalidateQueries({ queryKey: ['/financial-institutions'] });
  const create = useCreateFinancialInstitution({ mutation: { onSuccess: invalidate } });
  const update = useUpdateFinancialInstitution({ mutation: { onSuccess: invalidate } });
  const activate = useActivateFinancialInstitution({ mutation: { onSuccess: invalidate } });
  const deactivate = useDeactivateFinancialInstitution({ mutation: { onSuccess: invalidate } });
  return (
    <Registry<FinancialInstitutionDto, { name: string; kind: FinancialInstitutionDto['kind'] }>
      resource={{
        title: t('investmentSetup.institutions.title'),
        description: t('investmentSetup.institutions.description'),
        empty: t('investmentSetup.institutions.empty'),
        columns: [t('investmentSetup.columns.institution'), t('investmentSetup.columns.type')],
        list: query.data ?? [],
        isPending: query.isPending,
        isError: query.isError,
        refetch: () => void query.refetch(),
        values: () => ({ name: '', kind: 'BANK' }),
        toValues: (item) => ({ name: item.name, kind: item.kind }),
        cells: (item) => (
          <>
            <TableCell>{item.name}</TableCell>
            <TableCell>{t(`investmentSetup.institutionKinds.${item.kind}`)}</TableCell>
          </>
        ),
        fields: (values, setValues) => (
          <div className="grid gap-4">
            {textField('name', t('investmentSetup.fields.name'), values.name, (name) => setValues({ ...values, name }))}
            <div className="grid gap-2">
              <Label htmlFor="kind">{t('investmentSetup.columns.type')}</Label>
              <select
                id="kind"
                className="h-9 rounded-md border border-input bg-transparent px-3"
                value={values.kind}
                onChange={(event) => setValues({ ...values, kind: event.target.value as FinancialInstitutionDto['kind'] })}
              >
                {(['BANK', 'BROKER', 'EXCHANGE'] as const).map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`investmentSetup.institutionKinds.${kind}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ),
        create: (values) => create.mutate({ data: values }),
        update: (id, values) => update.mutate({ id, data: values }),
        activate: (id) => activate.mutate({ id }),
        deactivate: (id) => deactivate.mutate({ id }),
      }}
    />
  );
}

export function InstrumentsPage() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const query = useListInstruments({ includeInactive: true });
  const invalidate = () => void client.invalidateQueries({ queryKey: ['/instruments'] });
  const create = useCreateInstrument({ mutation: { onSuccess: invalidate } });
  const update = useUpdateInstrument({ mutation: { onSuccess: invalidate } });
  const activate = useActivateInstrument({ mutation: { onSuccess: invalidate } });
  const deactivate = useDeactivateInstrument({ mutation: { onSuccess: invalidate } });
  return (
    <Registry<InstrumentDto, { name: string; code: string; type: InstrumentDto['type']; displayPrecision: string }>
      resource={{
        title: t('investmentSetup.instruments.title'),
        description: t('investmentSetup.instruments.description'),
        empty: t('investmentSetup.instruments.empty'),
        columns: [
          t('investmentSetup.columns.instrument'),
          t('investmentSetup.columns.code'),
          t('investmentSetup.columns.type'),
          t('investmentSetup.columns.precision'),
        ],
        list: query.data ?? [],
        isPending: query.isPending,
        isError: query.isError,
        refetch: () => void query.refetch(),
        values: () => ({ name: '', code: '', type: 'FIAT', displayPrecision: '2' }),
        toValues: (item) => ({ name: item.name, code: item.code, type: item.type, displayPrecision: String(item.displayPrecision) }),
        cells: (item) => (
          <>
            <TableCell>{item.name}</TableCell>
            <TableCell>{item.code}</TableCell>
            <TableCell>{t(`investmentSetup.instrumentTypes.${item.type}`)}</TableCell>
            <TableCell>{item.displayPrecision}</TableCell>
          </>
        ),
        fields: (values, setValues) => (
          <div className="grid gap-4">
            {textField('name', t('investmentSetup.fields.name'), values.name, (name) => setValues({ ...values, name }))}
            {textField('code', t('investmentSetup.columns.code'), values.code, (code) => setValues({ ...values, code }))}
            <div className="grid gap-2">
              <Label htmlFor="type">{t('investmentSetup.columns.type')}</Label>
              <select
                id="type"
                className="h-9 rounded-md border border-input bg-transparent px-3"
                value={values.type}
                onChange={(event) => setValues({ ...values, type: event.target.value as InstrumentDto['type'] })}
              >
                {(['FIAT', 'STABLECOIN', 'CRYPTOCURRENCY', 'STOCK', 'ETF', 'ETC'] as const).map((type) => (
                  <option key={type} value={type}>
                    {t(`investmentSetup.instrumentTypes.${type}`)}
                  </option>
                ))}
              </select>
            </div>
            {textField('precision', t('investmentSetup.columns.precision'), values.displayPrecision, (displayPrecision) =>
              setValues({ ...values, displayPrecision }),
            )}
          </div>
        ),
        create: (values) => create.mutate({ data: { ...values, displayPrecision: Number(values.displayPrecision) } }),
        update: (id, values) => update.mutate({ id, data: { ...values, displayPrecision: Number(values.displayPrecision) } }),
        activate: (id) => activate.mutate({ id }),
        deactivate: (id) => deactivate.mutate({ id }),
      }}
    />
  );
}

export function AssetListingsPage() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const query = useListAssetListings({ includeInactive: true });
  const instruments = useListInstruments();
  const invalidate = () => void client.invalidateQueries({ queryKey: ['/asset-listings'] });
  const create = useCreateAssetListing({ mutation: { onSuccess: invalidate } });
  const update = useUpdateAssetListing({ mutation: { onSuccess: invalidate } });
  const activate = useActivateAssetListing({ mutation: { onSuccess: invalidate } });
  const deactivate = useDeactivateAssetListing({ mutation: { onSuccess: invalidate } });
  const options = instruments.data ?? [];
  return (
    <Registry<AssetListingDto, { instrumentId: string; quoteInstrumentId: string; market: string; ticker: string; isin: string; providerSymbol: string }>
      resource={{
        title: t('investmentSetup.listings.title'),
        description: t('investmentSetup.listings.description'),
        empty: t('investmentSetup.listings.empty'),
        columns: [
          t('investmentSetup.columns.asset'),
          t('investmentSetup.columns.ticker'),
          t('investmentSetup.columns.market'),
          t('investmentSetup.columns.quote'),
        ],
        list: query.data ?? [],
        isPending: query.isPending || instruments.isPending,
        isError: query.isError || instruments.isError,
        refetch: () => {
          void query.refetch();
          void instruments.refetch();
        },
        values: () => ({ instrumentId: options[0]?.id ?? '', quoteInstrumentId: options[0]?.id ?? '', market: '', ticker: '', isin: '', providerSymbol: '' }),
        toValues: (item) => ({
          instrumentId: item.instrumentId,
          quoteInstrumentId: item.quoteInstrumentId,
          market: item.market,
          ticker: item.ticker,
          isin: item.isin ?? '',
          providerSymbol: item.providerSymbol ?? '',
        }),
        cells: (item) => (
          <>
            <TableCell>{item.instrumentName}</TableCell>
            <TableCell>{item.ticker}</TableCell>
            <TableCell>{item.market}</TableCell>
            <TableCell>{item.quoteInstrumentCode}</TableCell>
          </>
        ),
        fields: (values, setValues) => (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="instrumentId">{t('investmentSetup.columns.asset')}</Label>
              <select
                id="instrumentId"
                className="h-9 rounded-md border border-input bg-transparent px-3"
                value={values.instrumentId}
                onChange={(event) => setValues({ ...values, instrumentId: event.target.value })}
              >
                {options.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quoteInstrumentId">{t('investmentSetup.fields.quoteInstrument')}</Label>
              <select
                id="quoteInstrumentId"
                className="h-9 rounded-md border border-input bg-transparent px-3"
                value={values.quoteInstrumentId}
                onChange={(event) => setValues({ ...values, quoteInstrumentId: event.target.value })}
              >
                {options.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.code}
                  </option>
                ))}
              </select>
            </div>
            {textField('market', t('investmentSetup.columns.market'), values.market, (market) => setValues({ ...values, market }))}
            {textField('ticker', t('investmentSetup.columns.ticker'), values.ticker, (ticker) => setValues({ ...values, ticker }))}
            {textField('isin', t('investmentSetup.fields.isin'), values.isin, (isin) => setValues({ ...values, isin }))}
            {textField('providerSymbol', t('investmentSetup.fields.providerSymbol'), values.providerSymbol, (providerSymbol) =>
              setValues({ ...values, providerSymbol }),
            )}
          </div>
        ),
        create: (values) => create.mutate({ data: values }),
        update: (id, values) => update.mutate({ id, data: values }),
        activate: (id) => activate.mutate({ id }),
        deactivate: (id) => deactivate.mutate({ id }),
      }}
    />
  );
}
