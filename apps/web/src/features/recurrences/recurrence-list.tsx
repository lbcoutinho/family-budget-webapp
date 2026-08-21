import { type AccountDto, type CategoryDto, type RecurrenceRuleDto } from '@family-budget/api-client';
import { type TFunction } from 'i18next';
import { Loader2Icon, PencilIcon, RepeatIcon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { installmentProgress, nextRollingOccurrence } from './occurrences';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import i18n, { type TranslationKey } from '@/i18n';
import { formatCents } from '@/lib/money';

function formKey(key: string): TranslationKey {
  return key as TranslationKey;
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function shortDate(locale: string): Intl.DateTimeFormat {
  const existing = dateFormatters.get(locale);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  dateFormatters.set(locale, formatter);
  return formatter;
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, (month ?? 1) - 1, day ?? 1);
}

interface CategoryLookup {
  name: string;
  color: string | null;
  parentName?: string;
}

function buildCategoryLookup(categories: CategoryDto[]): Map<string, CategoryLookup> {
  const map = new Map<string, CategoryLookup>();
  for (const root of categories) {
    map.set(root.id, { name: root.name, color: root.color });
    for (const child of root.children ?? []) {
      map.set(child.id, { name: child.name, color: root.color, parentName: root.name });
    }
  }
  return map;
}

export function frequencyLabel(rule: RecurrenceRuleDto, t: TFunction): string {
  if (rule.frequency === 'YEARLY') {
    const start = parseDateOnly(rule.startDate);
    const date = `${String(rule.dayOfMonth).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`;
    return t(formKey('recurrences.frequency.YEARLY'), { date });
  }
  return t(formKey('recurrences.frequency.MONTHLY'), { day: rule.dayOfMonth });
}

export interface RecurrenceListProps {
  rules: RecurrenceRuleDto[];
  accounts: AccountDto[];
  categories: CategoryDto[];
  generatingId?: string;
  onEdit: (rule: RecurrenceRuleDto) => void;
  onGenerate: (rule: RecurrenceRuleDto) => void;
  onDeactivate: (rule: RecurrenceRuleDto) => void;
  onCancelInstallments: (rule: RecurrenceRuleDto) => void;
}

export function RecurrenceList({ rules, accounts, categories, generatingId, onEdit, onGenerate, onDeactivate, onCancelInstallments }: RecurrenceListProps) {
  const { t } = useTranslation();
  const accountsById = new Map(accounts.map((account) => [account.id, account.name]));
  const categoriesById = buildCategoryLookup(categories);
  const today = new Date();

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-[11.5px] text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">{t('recurrences.table.rule')}</th>
              <th className="px-4 py-2.5 font-medium">{t('recurrences.table.account')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('recurrences.table.amount')}</th>
              <th className="px-4 py-2.5 font-medium">{t('recurrences.table.when')}</th>
              <th className="px-4 py-2.5 font-medium">{t('recurrences.table.progress')}</th>
              <th className="px-4 py-2.5 font-medium">{t('recurrences.table.next')}</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const category = rule.categoryId ? categoriesById.get(rule.categoryId) : undefined;
              const subcategory = rule.subcategoryId ? categoriesById.get(rule.subcategoryId) : undefined;
              const isInstallment = rule.totalOccurrences !== null;
              const progress = isInstallment ? installmentProgress(rule, today) : undefined;
              const next = isInstallment ? progress?.next : rule.isActive ? nextRollingOccurrence(rule) : null;
              const signedAmount = rule.amount === null ? null : rule.type === 'INCOME' ? rule.amount : -rule.amount;

              return (
                <tr key={rule.id} className={`border-b last:border-b-0 ${!rule.isActive ? 'text-muted-foreground' : ''}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      {category?.color ? <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} /> : null}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`truncate font-semibold ${!rule.isActive ? 'font-medium' : ''}`}>{rule.description}</span>
                          {!rule.autoConfirm ? (
                            <Badge variant="outline" className="border-dashed text-[10.5px]">
                              {t('recurrences.table.draftBadge')}
                            </Badge>
                          ) : null}
                          {!rule.isActive ? (
                            <Badge variant="outline" className="text-[10.5px]">
                              {t('recurrences.table.inactiveBadge')}
                            </Badge>
                          ) : null}
                        </div>
                        {category ? (
                          <p className="truncate text-[12px] text-muted-foreground">
                            {category.parentName ? `${category.parentName} · ${category.name}` : category.name}
                            {subcategory ? ` · ${subcategory.name}` : ''}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{rule.accountId ? (accountsById.get(rule.accountId) ?? '—') : '—'}</td>
                  <td className="num px-4 py-2.5 text-right font-semibold">{formatCents(signedAmount, { sign: true })}</td>
                  <td className="num px-4 py-2.5 text-muted-foreground">{frequencyLabel(rule, t)}</td>
                  <td className="px-4 py-2.5">
                    {!isInstallment ? (
                      rule.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                          <RepeatIcon className="size-3.5" />
                          {t('recurrences.table.endless')}
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-muted-foreground">
                          {rule.generatedUntil
                            ? t('recurrences.table.stoppedOn', { date: shortDate(i18n.language).format(parseDateOnly(rule.generatedUntil)) })
                            : '—'}
                        </span>
                      )
                    ) : (
                      <div className="min-w-[108px]">
                        <span className="num font-semibold">
                          {progress!.elapsed}/{rule.totalOccurrences}
                        </span>
                        <span className="block text-[11.5px] text-muted-foreground">
                          {progress!.elapsed >= rule.totalOccurrences!
                            ? t('recurrences.table.completed')
                            : rule.amount !== null
                              ? t('recurrences.table.toPay', { amount: formatCents((rule.totalOccurrences! - progress!.elapsed) * rule.amount) })
                              : null}
                        </span>
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-foreground/70"
                            style={{ width: `${Math.min(100, (progress!.elapsed / rule.totalOccurrences!) * 100)}%` }}
                          />
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="num px-4 py-2.5 text-muted-foreground">{next ? shortDate(i18n.language).format(next) : '—'}</td>
                  <td className="px-4 py-2.5">
                    {rule.isActive ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={t('recurrences.actions.generate')}
                          onClick={() => onGenerate(rule)}
                          disabled={generatingId === rule.id}
                        >
                          {generatingId === rule.id ? <Loader2Icon className="animate-spin" /> : <RepeatIcon />}
                        </Button>
                        {isInstallment ? (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t('recurrences.actions.cancelInstallments')}
                            onClick={() => onCancelInstallments(rule)}
                          >
                            <XIcon />
                          </Button>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon-xs" aria-label={t('recurrences.actions.edit')} onClick={() => onEdit(rule)}>
                              <PencilIcon />
                            </Button>
                            <Button variant="ghost" size="icon-xs" aria-label={t('recurrences.actions.deactivate')} onClick={() => onDeactivate(rule)}>
                              <XIcon />
                            </Button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RecurrenceListSkeleton() {
  return (
    <div className="space-y-px rounded-lg border p-3" aria-label="Loading recurrences">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}
