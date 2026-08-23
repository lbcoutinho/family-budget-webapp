import { type CsvImportResultDto, useConfirmCsvImport, useListAccounts, useListCsvImportModels, usePreviewCsvImport } from '@family-budget/api-client';
import { AlertCircleIcon, CheckCircle2Icon, FileUpIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiErrorMessage } from '@/lib/api-error';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function isCsvFile(file: File): boolean {
  return file.size <= MAX_FILE_SIZE && (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv'));
}

function ResultDetails({ label, rows }: { label: string; rows: CsvImportResultDto['new'] }) {
  if (rows.length === 0) return null;

  return (
    <details className="border-t px-4 py-3">
      <summary className="cursor-pointer font-semibold">{label}</summary>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {rows.map((row) => (
          <li key={row.line}>
            {row.line}
            {row.reason ? ` · ${row.reason}` : ''}
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
      <main className="mx-auto w-full max-w-[1120px] px-3.5 pt-4 pb-10 shell:p-[22px]">
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {apiErrorMessage(models.isError ? models.error : accounts.error, t)}
        </p>
        <Button className="mt-3" variant="outline" onClick={() => void Promise.all([models.refetch(), accounts.refetch()])}>
          {t('common.retry')}
        </Button>
      </main>
    );
  }

  if (models.data?.length === 0) {
    return (
      <main className="mx-auto w-full max-w-[1120px] px-3.5 pt-4 pb-10 shell:p-[22px]">
        <section className="max-w-2xl rounded-lg border p-6">
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">{t('transactions.import.noModelTitle')}</h1>
          <p className="mt-2 text-muted-foreground">{t('transactions.import.noModelDescription')}</p>
          <Button className="mt-5" onClick={() => void navigate('/settings/general')}>
            {t('transactions.import.goToSettings')}
          </Button>
        </section>
      </main>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/92 px-3.5 py-2.5 backdrop-blur-md shell:px-[22px] shell:py-3">
        <h1 className="font-display text-[1.05rem] font-bold tracking-[-0.02em]">{t('transactions.import.title')}</h1>
        <Button variant="outline" size="sm" onClick={() => void navigate('/month')}>
          {t('transactions.import.back')}
        </Button>
      </header>
      <main className="mx-auto w-full max-w-[1120px] px-3.5 pt-4 pb-10 shell:p-[22px]">
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
            <input
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
          <p className="mt-2 text-sm text-destructive" role="alert">
            {fileError}
          </p>
        ) : null}
        {importError ? (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
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
              <table className="w-full min-w-[520px] text-sm">
                <thead className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="sticky left-0 bg-muted/60 p-3">
                      <input
                        type="checkbox"
                        aria-label={t('transactions.import.selectAll')}
                        checked={allSelected}
                        onChange={(event) => setSelected(event.target.checked ? newLines : [])}
                      />
                    </th>
                    <th className="p-3">{t('transactions.import.line')}</th>
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
                    />
                  ))}
                  {preview.duplicate.map((row) => (
                    <Row key={row.line} row={row} label={t('transactions.import.duplicateRow')} />
                  ))}
                  {preview.invalid.map((row) => (
                    <Row key={row.line} row={row} label={t('transactions.import.invalidRow')} />
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
            <div className="flex gap-3 rounded-lg border border-emerald-700/30 bg-emerald-50 p-4">
              <CheckCircle2Icon className="size-5 shrink-0 text-emerald-700" />
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
      </main>
    </>
  );
}

function Row({
  row,
  selected,
  onChange,
  selectionLabel,
  label,
}: {
  row: CsvImportResultDto['new'][number];
  selected?: boolean;
  onChange?: () => void;
  selectionLabel?: string;
  label: string;
}) {
  return (
    <tr className={onChange ? '' : 'bg-muted/40 text-muted-foreground'}>
      <td className="sticky left-0 bg-inherit p-3">
        <input type="checkbox" disabled={!onChange} checked={selected ?? false} onChange={onChange} aria-label={selectionLabel ?? label} />
      </td>
      <td className="p-3 num">{row.line}</td>
      <td className="p-3">
        <span className="rounded bg-muted px-2 py-0.5 text-xs">{label}</span>
      </td>
      <td className="p-3">{row.reason ?? '—'}</td>
    </tr>
  );
}

function PageLoading() {
  return (
    <main className="mx-auto w-full max-w-[1120px] space-y-4 px-3.5 pt-4 shell:p-[22px]">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-24 w-full" />
    </main>
  );
}
