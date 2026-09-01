import { type CsvImportResultDto, useConfirmCsvImport, useListAccounts, useListCsvImportModels, usePreviewCsvImport } from '@family-budget/api-client';
import { AlertCircleIcon, CheckCircle2Icon, FileUpIcon, TriangleAlertIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { PageContent, PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiErrorMessage } from '@/lib/api-error';
import { formatDate, parseDateOnly } from '@/lib/date';
import { formatCents } from '@/lib/money';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const PREVIEW_META_CELL = 'p-3 num text-field text-muted-foreground';

function isCsvFile(file: File): boolean {
  return file.size <= MAX_FILE_SIZE && (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv'));
}

function ResultDetails({ label, rows }: { label: string; rows: CsvImportResultDto['new'] }) {
  const { t } = useTranslation();

  if (rows.length === 0) return null;

  return (
    <details className="border-t px-4 py-3">
      <summary className="cursor-pointer font-semibold">{label}</summary>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {rows.map((row) => (
          <li key={row.line}>
            {row.line}
            {row.reason ? ` · ${t(`transactions.import.rowErrors.${row.reason}`, { defaultValue: row.reason })}` : ''}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function CsvImportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [modelId, setModelId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [file, setFile] = useState<File>();
  const [fileError, setFileError] = useState<string>();
  const [preview, setPreview] = useState<CsvImportResultDto>();
  const [result, setResult] = useState<CsvImportResultDto>();
  const [selected, setSelected] = useState<number[]>([]);
  const models = useListCsvImportModels();
  const accounts = useListAccounts();
  const previewImport = usePreviewCsvImport({
    mutation: {
      onSuccess: (next) => {
        setPreview(next);
        setResult(undefined);
        setSelected(next.new.map((row) => row.line));
      },
    },
  });
  const confirmImport = useConfirmCsvImport({ mutation: { onSuccess: (next) => setResult(next) } });
  const importError = previewImport.isError ? previewImport.error : confirmImport.isError ? confirmImport.error : undefined;
  const newLines = useMemo(() => preview?.new.map((row) => row.line) ?? [], [preview]);
  const allSelected = newLines.length > 0 && selected.length === newLines.length;

  const changeFile = (next: File | undefined) => {
    setPreview(undefined);
    setResult(undefined);
    setSelected([]);
    if (!next) return setFile(undefined);
    if (!isCsvFile(next)) {
      setFile(undefined);
      return setFileError(t('transactions.import.fileInvalid'));
    }
    setFile(next);
    setFileError(undefined);
  };

  const submitPreview = () => {
    if (!file) return setFileError(t('transactions.import.fileRequired'));
    if (!modelId || !accountId) return;
    previewImport.mutate({ data: { modelId, accountId, file } });
  };

  const submitConfirm = () => {
    if (!file || !modelId || !accountId || selected.length === 0 || confirmImport.isPending) return;
    confirmImport.mutate({ data: { modelId, accountId, selectedLines: selected, file } });
  };

  if (models.isPending || accounts.isPending) {
    return <PageLoading />;
  }

  if (models.isError || accounts.isError) {
    return (
      <PageContent>
        <p className="flex items-start gap-3 rounded-md border-l-4 border-destructive bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" />
          {apiErrorMessage(models.isError ? models.error : accounts.error, t)}
        </p>
        <Button className="mt-3" variant="outline" onClick={() => void Promise.all([models.refetch(), accounts.refetch()])}>
          {t('common.retry')}
        </Button>
      </PageContent>
    );
  }

  if (models.data?.length === 0) {
    return (
      <PageContent>
        <section className="max-w-2xl rounded-lg border p-6">
          <h1 className="font-display text-2xl font-bold tracking-headline">{t('transactions.import.noModelTitle')}</h1>
          <p className="mt-2 text-muted-foreground">{t('transactions.import.noModelDescription')}</p>
          <Button className="mt-5" onClick={() => void navigate('/settings/general')}>
            {t('transactions.import.goToSettings')}
          </Button>
        </section>
      </PageContent>
    );
  }

  return (
    <>
      <PageHeader
        title={t('transactions.import.title')}
        actions={
          <Button variant="outline" size="sm" onClick={() => void navigate('/month')}>
            {t('transactions.import.back')}
          </Button>
        }
      />
      <PageContent>
        <p className="mb-5 max-w-2xl text-muted-foreground">{t('transactions.import.description')}</p>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium">
            {t('transactions.import.model')}
            <NativeSelect value={modelId} onChange={(event) => setModelId(event.target.value)}>
              <option value="" disabled />
              {models.data?.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t('transactions.import.account')}
            <NativeSelect value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="" disabled />
              {accounts.data?.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <div className="flex min-h-24 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/50 p-3 text-center">
            <Input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              aria-label={t('transactions.import.file')}
              onChange={(event) => changeFile(event.target.files?.[0])}
            />
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <FileUpIcon />
              {file ? t('transactions.import.changeFile') : t('transactions.import.chooseFile')}
            </Button>
            <span className="mt-1 text-xs text-muted-foreground">{file?.name}</span>
          </div>
        </div>
        {fileError ? (
          <p className="mt-2 flex items-start gap-3 rounded-md border-l-4 border-destructive bg-destructive/10 p-4 text-sm text-destructive" role="alert">
            <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" />
            {fileError}
          </p>
        ) : null}
        {importError ? (
          <p className="mt-4 flex items-start gap-3 rounded-md border-l-4 border-destructive bg-destructive/10 p-4 text-sm text-destructive" role="alert">
            <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" />
            {apiErrorMessage(importError, t)}
          </p>
        ) : null}
        <div className="mt-4">
          <Button onClick={submitPreview} disabled={!modelId || !accountId || !file || previewImport.isPending}>
            {previewImport.isPending ? t('transactions.import.previewing') : t('transactions.import.preview')}
          </Button>
        </div>
        {previewImport.isPending ? (
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            {t('transactions.import.previewStatus')}
          </p>
        ) : null}
        {preview && !result ? (
          <section className="mt-5 overflow-hidden rounded-lg border">
            <div className="grid grid-cols-2 divide-x divide-y border-b sm:grid-cols-4">
              {(['new', 'duplicate', 'invalid'] as const).map((key) => (
                <div key={key} className="p-3">
                  <strong className="block text-2xl num">{preview[key].length}</strong>
                  <span className="text-xs text-muted-foreground">{t(`transactions.import.${key}`)}</span>
                </div>
              ))}
              <div className="p-3">
                <strong className="block text-2xl num">{selected.length}</strong>
                <span className="text-xs text-muted-foreground">{t('transactions.import.selected')}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-import-table text-sm">
                <thead className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="sticky left-0 bg-muted/60 p-3">
                      <Checkbox
                        aria-label={t('transactions.import.selectAll')}
                        checked={allSelected}
                        onCheckedChange={(checked) => setSelected(checked ? newLines : [])}
                      />
                    </th>
                    <th className="p-3">{t('transactions.import.line')}</th>
                    <th className="p-3">{t('transactions.import.date')}</th>
                    <th className="p-3">{t('transactions.import.descriptionColumn')}</th>
                    <th className="p-3 text-right">{t('transactions.import.amount')}</th>
                    <th className="p-3">{t('transactions.import.category')}</th>
                    <th className="p-3">{t('transactions.import.subcategory')}</th>
                    <th className="p-3">{t('transactions.import.status')}</th>
                    <th className="p-3">{t('transactions.import.reason')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.new.map((row) => (
                    <Row
                      key={row.line}
                      row={row}
                      selected={selected.includes(row.line)}
                      onChange={() => setSelected((lines) => (lines.includes(row.line) ? lines.filter((line) => line !== row.line) : [...lines, row.line]))}
                      selectionLabel={t('transactions.import.selectLine', { line: row.line })}
                      label={t('transactions.import.newRow')}
                      status="new"
                    />
                  ))}
                  {preview.duplicate.map((row) => (
                    <Row key={row.line} row={row} label={t('transactions.import.duplicateRow')} status="duplicate" />
                  ))}
                  {preview.invalid.map((row) => (
                    <Row key={row.line} row={row} label={t('transactions.import.invalidRow')} status="invalid" />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3">
              <span className="text-sm text-muted-foreground" role="status">
                {t('transactions.import.selectedCount', { selected: selected.length, total: preview.new.length })}
              </span>
              <Button onClick={submitConfirm} disabled={selected.length === 0 || confirmImport.isPending}>
                {confirmImport.isPending
                  ? t('transactions.import.confirming')
                  : selected.length === 0
                    ? t('transactions.import.confirmZero')
                    : t('transactions.import.confirm', { count: selected.length })}
              </Button>
            </div>
            {selected.length === 0 ? (
              <div className="flex gap-2 border-t bg-muted/50 p-3 text-sm" role="status">
                <AlertCircleIcon className="size-5 shrink-0" />
                <div>
                  <strong>{t('transactions.import.nothingSelectedTitle')}</strong>
                  <p className="text-muted-foreground">{t('transactions.import.nothingSelectedDescription')}</p>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
        {result ? (
          <section className="mt-5">
            <div className="flex gap-3 rounded-lg border border-income/30 bg-income-wash p-4">
              <CheckCircle2Icon className="size-5 shrink-0 text-income" />
              <div>
                <strong>{t('transactions.import.successTitle', { count: result.new.length })}</strong>
                <p className="text-sm text-muted-foreground">{t('transactions.import.successDescription')}</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border">
              <ResultDetails label={t('transactions.import.result.imported', { count: result.new.length })} rows={result.new} />
              <ResultDetails label={t('transactions.import.result.duplicate', { count: result.duplicate.length })} rows={result.duplicate} />
              <ResultDetails label={t('transactions.import.result.invalid', { count: result.invalid.length })} rows={result.invalid} />
              <ResultDetails label={t('transactions.import.result.notSelected', { count: result.notSelected.length })} rows={result.notSelected} />
            </div>
            <Button className="mt-4" onClick={() => void navigate('/month')}>
              {t('transactions.import.back')}
            </Button>
          </section>
        ) : null}
      </PageContent>
    </>
  );
}

function Row({
  row,
  selected,
  onChange,
  selectionLabel,
  label,
  status,
}: {
  row: CsvImportResultDto['new'][number];
  selected?: boolean;
  onChange?: () => void;
  selectionLabel?: string;
  label: string;
  status: 'new' | 'duplicate' | 'invalid';
}) {
  const { t } = useTranslation();

  return (
    <tr className={onChange ? '' : 'bg-muted/40 text-muted-foreground'}>
      <td className="sticky left-0 bg-inherit p-3">
        <Checkbox disabled={!onChange} checked={selected ?? false} onCheckedChange={onChange} aria-label={selectionLabel ?? label} />
      </td>
      <td className={PREVIEW_META_CELL}>{row.line}</td>
      <td className={PREVIEW_META_CELL}>{row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? formatDate(parseDateOnly(row.date)) : (row.date ?? '—')}</td>
      <td className="max-w-64 truncate p-3 text-sm font-semibold">{row.description ?? '—'}</td>
      <td className="p-3 text-right">
        <span
          className={`num block whitespace-nowrap text-sm font-medium ${row.type === 'EXPENSE' ? 'text-destructive' : row.type === 'INCOME' ? 'text-income' : ''}`}
        >
          {row.amount === undefined ? '—' : formatCents(row.type === 'EXPENSE' ? -row.amount : row.amount, { sign: true })}
        </span>
      </td>
      <td className="max-w-48 truncate p-3 text-sm text-muted-foreground">{row.suggestedCategoryName ?? '—'}</td>
      <td className="max-w-48 truncate p-3 text-sm text-muted-foreground">{row.suggestedSubcategoryName ?? '—'}</td>
      <td className="p-3">
        <Badge
          variant="outline"
          className={`text-badge ${
            status === 'new' ? 'bg-income-wash text-income' : status === 'duplicate' ? 'bg-transfer/10 text-transfer' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {label}
        </Badge>
      </td>
      <td className="max-w-64 truncate p-3 text-sm text-muted-foreground">
        {row.reason ? t(`transactions.import.rowErrors.${row.reason}`, { defaultValue: row.reason }) : '—'}
      </td>
    </tr>
  );
}

function PageLoading() {
  return (
    <PageContent className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-24 w-full" />
    </PageContent>
  );
}
