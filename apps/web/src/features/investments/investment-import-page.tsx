import {
  type InvestmentImportPreviewBalanceDto,
  type InvestmentImportPreviewDto,
  type InvestmentImportPreviewPositionDto,
  useConfirmInvestmentImport,
  usePreviewInvestmentImport,
} from '@family-budget/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { type TFunction } from 'i18next';
import { FileUpIcon, TriangleAlertIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { InvestmentSectionNav } from './investment-section-nav';

import { EmptyState } from '@/components/empty-state';
import { PageContent, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiErrorMessage } from '@/lib/api-error';
import { formatDecimal } from '@/lib/decimal';

type ReconciliationRow = (InvestmentImportPreviewPositionDto | InvestmentImportPreviewBalanceDto) & { position: boolean };
type Choice = 'create' | 'csv' | 'leave';
interface ReconciliationValue {
  actual: string;
  choice: Choice;
  reason: string;
  cost: string;
}

const key = (row: Pick<ReconciliationRow, 'accountId' | 'instrumentId'>) => `${row.accountId}:${row.instrumentId}`;

export function InvestmentImportPage() {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<InvestmentImportPreviewDto>();
  const [stage, setStage] = useState<'file' | 'preview' | 'reconcile' | 'review'>('file');
  const [values, setValues] = useState<Record<string, ReconciliationValue>>({});
  const [confirmed, setConfirmed] = useState(false);
  const previewImport = usePreviewInvestmentImport({
    mutation: {
      onSuccess: (result) => {
        setPreview(result);
        setStage(result.errors.length ? 'file' : 'preview');
        setValues({});
      },
    },
  });
  const confirm = useConfirmInvestmentImport({
    mutation: {
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: ['/investment-trades'] });
        void client.invalidateQueries({ queryKey: ['/investment-positions'] });
        void client.invalidateQueries({ queryKey: ['/accounts/instrument-balances'] });
        toast.success(t('investmentImport.complete'));
        setStage('file');
        setPreview(undefined);
        setFile(undefined);
        setValues({});
        setConfirmed(false);
      },
    },
  });
  const rows = useMemo(() => reconciliationRows(preview), [preview]);
  const update = (row: ReconciliationRow, change: Partial<ReconciliationValue>) =>
    setValues((current) => ({ ...current, [key(row)]: { actual: '', choice: 'create', reason: '', cost: '', ...current[key(row)], ...change } }));
  const canReview = rows.every((row) => valid(row, values[key(row)]));
  const accepted = rows.filter((row) => {
    const value = values[key(row)];
    return value && difference(row, value.actual) !== '0' && value.choice === 'create';
  });

  return (
    <>
      <PageHeader title={t('investmentImport.title')} />
      <PageContent className="space-y-4">
        <InvestmentSectionNav />
        <p className="text-sm text-muted-foreground">{t('investmentImport.description')}</p>
        <ol className="grid grid-cols-3 gap-2 text-xs text-muted-foreground" aria-label={t('investmentImport.steps')}>
          {(['file', 'preview', 'reconcile', 'review'] as const).map((item, index) => (
            <li key={item} className={stage === item ? 'font-medium text-foreground' : ''}>{`${index + 1}. ${t(`investmentImport.${item}`)}`}</li>
          ))}
        </ol>
        {stage === 'file' && (
          <Card className="space-y-4 p-5">
            <div>
              <h2 className="font-semibold">{t('investmentImport.file')}</h2>
              <p className="text-sm text-muted-foreground">{t('investmentImport.fileDescription')}</p>
            </div>
            <Input
              ref={input}
              className="sr-only"
              aria-label={t('investmentImport.chooseFile')}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0])}
            />
            <Button variant="outline" onClick={() => input.current?.click()}>
              <FileUpIcon /> {file?.name ?? t('investmentImport.chooseFile')}
            </Button>
            {preview?.errors.length ? <Issues title={t('investmentImport.errors')} issues={preview.errors} /> : null}
            {preview?.warnings.length ? (
              <Issues title={t('investmentImport.warnings')} description={t('investmentImport.warningsDescription')} issues={preview.warnings} warning />
            ) : null}
            {previewImport.error && <p className="text-sm text-destructive">{apiErrorMessage(previewImport.error, t)}</p>}
            <Button disabled={!file || previewImport.isPending} onClick={() => file && previewImport.mutate({ data: { file } })}>
              {t('investmentImport.preview')}
            </Button>
          </Card>
        )}
        {stage === 'preview' && preview && (
          <Card className="space-y-4 p-5">
            <div>
              <h2 className="font-semibold">{t('investmentImport.preview')}</h2>
              <p className="text-sm text-muted-foreground">{t('investmentImport.previewDescription', { count: preview.validRows })}</p>
            </div>
            {preview.warnings.length > 0 && (
              <Issues title={t('investmentImport.warnings')} description={t('investmentImport.warningsDescription')} issues={preview.warnings} warning />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStage('file')}>
                {t('investmentImport.returnToFile')}
              </Button>
              <Button onClick={() => setStage('reconcile')}>{t('investmentImport.continue')}</Button>
              <Button variant="outline" onClick={() => setStage('review')}>
                {t('investmentImport.skipReconciliation')}
              </Button>
            </div>
          </Card>
        )}
        {stage === 'reconcile' && preview && (
          <section className="space-y-4">
            <Card className="space-y-4 p-5">
              <div>
                <h2 className="font-semibold">{t('investmentImport.reconcile')}</h2>
                <p className="text-sm text-muted-foreground">{t('investmentImport.reconcileDescription')}</p>
              </div>
              <div className="space-y-4">
                {rows.map((row) => (
                  <ReconciliationInput key={key(row)} row={row} value={values[key(row)]} locale={i18n.language} update={update} t={t} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setStage('file')}>
                  {t('investmentImport.returnToFile')}
                </Button>
                <Button disabled={!canReview} onClick={() => setStage('review')}>
                  {t('investmentImport.review')}
                </Button>
              </div>
            </Card>
          </section>
        )}
        {stage === 'review' && file && (
          <Card className="space-y-4 p-5">
            <div>
              <h2 className="font-semibold">{t('investmentImport.review')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('investmentImport.reviewDescription', { rows: preview?.validRows ?? 0, adjustments: accepted.length })}
              </p>
            </div>
            {preview?.warnings.length ? (
              <Issues title={t('investmentImport.warnings')} description={t('investmentImport.warningsDescription')} issues={preview.warnings} warning />
            ) : null}
            {accepted.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {accepted.map((row) => (
                  <li key={key(row)}>{`${row.accountName} · ${row.instrumentCode}: ${difference(row, values[key(row)]!.actual)}`}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t('investmentImport.noAdjustments')}</p>
            )}
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} />
              {t(preview?.warnings.length ? 'investmentImport.warningConfirmation' : 'investmentImport.confirmation')}
            </label>
            {confirm.error && <p className="text-sm text-destructive">{apiErrorMessage(confirm.error, t)}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStage('reconcile')}>
                {t('common.back')}
              </Button>
              <Button
                disabled={!confirmed || confirm.isPending}
                onClick={() =>
                  confirm.mutate({
                    data: {
                      file,
                      reconciliation: JSON.stringify(accepted.map((row) => reconciliation(row, values[key(row)]!))),
                      ...(preview?.warnings.length ? { acknowledgeWarnings: true } : {}),
                    },
                  })
                }
              >
                {t('investmentImport.confirm')}
              </Button>
            </div>
          </Card>
        )}
        {!previewImport.isPending && preview && stage === 'file' && preview.errors.length === 0 && (
          <EmptyState icon={TriangleAlertIcon} title={t('investmentImport.error.title')} description={t('investmentImport.error.description')} />
        )}
      </PageContent>
    </>
  );
}

function ReconciliationInput({
  row,
  value,
  locale,
  update,
  t,
}: {
  row: ReconciliationRow;
  value?: ReconciliationValue;
  locale: string;
  update: (row: ReconciliationRow, change: Partial<ReconciliationValue>) => void;
  t: TFunction;
}) {
  const actual = value?.actual ?? '';
  const delta = actual && decimal(actual) ? difference(row, actual) : '';
  const changed = delta !== '' && delta !== '0';
  return (
    <fieldset className="grid gap-3 border-t pt-4 sm:grid-cols-4">
      <legend className="sr-only">{`${row.accountName} ${row.instrumentCode}`}</legend>
      <div>
        <p className="font-medium">{`${row.accountName} · ${row.instrumentCode}`}</p>
        <p className="text-xs text-muted-foreground">{row.position ? String(t('investmentImport.position')) : String(t('investmentImport.balance'))}</p>
      </div>
      <div>
        <Label>{t('investmentImport.calculated')}</Label>
        <p className="mt-2 text-sm">{formatDecimal(row.quantity, locale)}</p>
      </div>
      <label className="grid gap-1 text-sm">
        <span>{t('investmentImport.actual')}</span>
        <Input
          aria-label={`${t('investmentImport.actual')} ${row.instrumentCode}`}
          value={actual}
          onChange={(event) => update(row, { actual: event.target.value })}
        />
      </label>
      <div>
        <Label>{t('investmentImport.difference')}</Label>
        <p className="mt-2 text-sm">{delta === '' ? '—' : formatDecimal(delta, locale)}</p>
      </div>
      {changed && (
        <div className="grid gap-2 sm:col-span-4 sm:grid-cols-3">
          <Select value={value?.choice ?? 'create'} onValueChange={(choice: Choice) => update(row, { choice })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="create">{t('investmentImport.createAdjustment')}</SelectItem>
              <SelectItem value="csv">{t('investmentImport.fixCsv')}</SelectItem>
              <SelectItem value="leave">{t('investmentImport.leave')}</SelectItem>
            </SelectContent>
          </Select>
          {(value?.choice ?? 'create') === 'create' && (
            <>
              <Textarea
                aria-label={`${t('investmentTrades.reason')} ${row.instrumentCode}`}
                placeholder={t('investmentTrades.reason')}
                value={value?.reason ?? ''}
                onChange={(event) => update(row, { reason: event.target.value })}
              />
              {row.position && delta.startsWith('+') && (
                <Input
                  aria-label={`${t('investmentTrades.cost')} ${row.instrumentCode}`}
                  placeholder={t('investmentTrades.cost')}
                  value={value?.cost ?? ''}
                  onChange={(event) => update(row, { cost: event.target.value })}
                />
              )}
            </>
          )}
        </div>
      )}
    </fieldset>
  );
}

function Issues({
  title,
  description,
  issues,
  warning = false,
}: {
  title: string;
  description?: string;
  issues: InvestmentImportPreviewDto['errors'] | InvestmentImportPreviewDto['warnings'];
  warning?: boolean;
}) {
  return (
    <div className={`rounded-md border p-3 text-sm ${warning ? 'border-amber-700/40 bg-amber-50 text-amber-950' : 'border-destructive/40'}`}>
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      <ul>
        {issues.map((issue) => (
          <li key={`${issue.line}:${issue.code}`}>{`${issue.line}: ${issue.message}`}</li>
        ))}
      </ul>
    </div>
  );
}
function reconciliationRows(preview?: InvestmentImportPreviewDto): ReconciliationRow[] {
  if (!preview) return [];
  const positions = preview.positions.map((row) => ({ ...row, position: true }));
  const keys = new Set(positions.map(key));
  return [...positions, ...preview.balances.filter((row) => !keys.has(key(row))).map((row) => ({ ...row, position: false }))];
}
function valid(row: ReconciliationRow, value?: ReconciliationValue): boolean {
  if (!value || !decimal(value.actual)) return false;
  const delta = difference(row, value.actual);
  return delta === '0' || value.choice !== 'create' || (value.reason.trim() !== '' && (!row.position || !delta.startsWith('+') || /^\d+$/.test(value.cost)));
}
function reconciliation(row: ReconciliationRow, value: ReconciliationValue) {
  return {
    accountId: row.accountId,
    instrumentId: row.instrumentId,
    actualQuantity: value.actual,
    effectiveAt: new Date().toISOString(),
    reason: value.reason,
    ...(value.cost ? { cost: Number(value.cost) } : {}),
  };
}
function decimal(value: string): string | null {
  return /^-?\d+(?:\.\d{1,18})?$/.test(value) ? value : null;
}
function difference(row: ReconciliationRow, actual: string): string {
  return subtract(actual, row.quantity);
}
function subtract(left: string, right: string): string {
  const [leftWhole = '0', leftFraction = ''] = left.split('.');
  const [rightWhole = '0', rightFraction = ''] = right.split('.');
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const scaled = (whole: string, fraction: string) =>
    BigInt(whole) * 10n ** BigInt(scale) + BigInt(`${whole.startsWith('-') ? '-' : ''}${fraction.padEnd(scale, '0') || '0'}`);
  const result = scaled(leftWhole, leftFraction) - scaled(rightWhole, rightFraction);
  const sign = result > 0n ? '+' : result < 0n ? '-' : '';
  const absolute = (result < 0n ? -result : result).toString().padStart(scale + 1, '0');
  const whole = scale ? absolute.slice(0, -scale) : absolute;
  const fraction = scale ? absolute.slice(-scale).replace(/0+$/, '') : '';
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
}
