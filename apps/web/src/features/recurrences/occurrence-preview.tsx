import { Loader2Icon } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { formatDate } from '@/lib/date';
import { formatCents } from '@/lib/money';

export interface OccurrencePreviewRow {
  date: Date;
  /** e.g. "adjusted — the month has no day 31" or "reference August/2026". */
  note?: string;
  amountCents: number;
  /** The 31st-of-the-month fallback (M7-T02) — painted the same as `amber`. */
  clamped?: boolean;
  /** The division remainder landing on the last installment (issue 198) — cashbox amber, not an error. */
  amber?: boolean;
}

export interface OccurrencePreviewProps {
  rows: OccurrencePreviewRow[];
  loading?: boolean;
  error?: string;
  /** Left side of the footer — e.g. "Next 6 occurrences" or a rounding note. */
  footerNote?: ReactNode;
  /** Right side of the footer — e.g. "1,900.00 € over the period". */
  footerTotal?: string;
  emptyMessage: string;
}

/** The mandatory "nothing is persisted until save" half of the fixed-rule and installment forms
 * (`prototypes/approved/12-recurrences.html`) — a debounced server preview for one, a locally
 * computed one for the other, rendered through this single dumb list so both read identically. */
export function OccurrencePreview({ rows, loading = false, error, footerNote, footerTotal, emptyMessage }: OccurrencePreviewProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2 border-b px-4 py-3">
        <h3 className="font-semibold">{t('recurrences.preview.title')}</h3>
        <span className="text-table-header text-muted-foreground">{t('recurrences.preview.notPersisted')}</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          {t('recurrences.preview.loading')}
        </div>
      ) : error ? (
        <p role="alert" className="px-4 py-6 text-sm text-destructive">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul>
          {rows.map((row, index) => (
            <li key={index} className="flex items-baseline gap-2.5 border-t px-4 py-1.5 text-table-cell first:border-t-0">
              <span className={`num w-20 shrink-0 ${row.clamped ? 'text-cashbox' : 'text-muted-foreground'}`}>{formatDate(row.date)}</span>
              {row.note ? <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.note}</span> : null}
              <span className={`num ml-auto font-semibold ${row.amber ? 'text-cashbox' : ''}`}>{formatCents(row.amountCents, { sign: true })}</span>
            </li>
          ))}
        </ul>
      )}
      {!loading && !error && rows.length > 0 ? (
        <div className="flex items-center justify-between gap-2 border-t bg-muted/50 px-4 py-2.5 text-table-meta">
          <span className="text-muted-foreground">{footerNote}</span>
          {footerTotal ? <span className="num ml-auto text-right font-semibold">{footerTotal}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
