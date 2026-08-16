import { useListAccountBalances, useListCashboxBalances } from '@family-budget/api-client';
import { useTranslation } from 'react-i18next';

import { StatCard } from '@/components/stat-card';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

const STALE_TIME = 30_000;
const SKELETON_CARDS = 4;

function BalancePanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-2.5 shell:grid-cols-4', className)} aria-hidden="true">
      {Array.from({ length: SKELETON_CARDS }, (_, index) => (
        <Card key={index} className="gap-1 p-4">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-2/3" />
        </Card>
      ))}
    </div>
  );
}

export interface BalancePanelProps {
  className?: string;
}

/** The consolidated balance panel that `/month` and `/cashboxes` both mount at the top: one card
 * per active account, one aggregated cashboxes card, one consolidated total (`06-month.html` lines
 * 374–396). Self-contained — it owns its own two queries so either screen can drop it in as-is. */
export function BalancePanel({ className }: BalancePanelProps) {
  const { t } = useTranslation();
  const accounts = useListAccountBalances(undefined, { query: { staleTime: STALE_TIME } });
  const cashboxes = useListCashboxBalances(undefined, { query: { staleTime: STALE_TIME } });

  if (accounts.isPending || cashboxes.isPending) {
    return <BalancePanelSkeleton className={className} />;
  }

  const activeAccounts = accounts.data?.filter((account) => account.isActive) ?? [];
  const accountsTotal = activeAccounts.reduce((sum, account) => sum + account.balance, 0);
  const activeCashboxes = cashboxes.data?.filter((cashbox) => cashbox.isActive) ?? [];
  const cashboxesTotal = activeCashboxes.reduce((sum, cashbox) => sum + cashbox.balance, 0);
  const failed = accounts.isError || cashboxes.isError;

  return (
    <section aria-label={t('balances.title')} className={cn('grid grid-cols-2 gap-2.5 shell:grid-cols-4', className)}>
      {activeAccounts.map((account) => (
        <StatCard key={account.accountId} label={account.name} value={formatCents(account.balance)} />
      ))}
      <StatCard label={t('balances.cashboxes')} value={formatCents(cashboxesTotal)} error={cashboxes.isError} />
      <Card className="gap-1 border-foreground bg-foreground p-4 text-background">
        <p className="text-xs text-background/70">{t('balances.total')}</p>
        <p className="font-display text-2xl font-bold tabular-nums">{failed ? '—' : formatCents(accountsTotal + cashboxesTotal)}</p>
      </Card>
    </section>
  );
}
