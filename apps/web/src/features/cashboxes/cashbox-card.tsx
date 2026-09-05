import { type CashboxDto } from '@family-budget/api-client';
import { PencilIcon, PowerIcon, PowerOffIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

export interface CashboxCardProps {
  cashbox: CashboxDto;
  /** Cents. `null` means the balance has not loaded. */
  balance: number | null;
  onEdit: () => void;
  onDeactivate: () => void;
  onActivate: () => void;
  onDelete: () => void;
}

export function CashboxGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="gap-3 p-4">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-7 w-1/2" />
        </Card>
      ))}
    </div>
  );
}

/** A cashbox tile: name, ghost icon actions, balance and an optional goal/progress block.
 * Purely presentational — the page owns data fetching, sorting and mutation wiring. */
export function CashboxCard({ cashbox, balance, onEdit, onDeactivate, onActivate, onDelete }: CashboxCardProps) {
  const { t } = useTranslation();

  const progress = balance !== null && cashbox.targetAmount !== null && cashbox.targetAmount > 0 ? Math.round((balance / cashbox.targetAmount) * 100) : null;
  const barProgress = progress === null ? null : Math.max(0, Math.min(100, progress));
  const reached = progress !== null && progress >= 100;

  return (
    <Card className={cn('gap-3 p-4', !cashbox.isActive && 'bg-muted/40 text-muted-foreground')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display font-bold tracking-tight">{cashbox.name}</h3>
            {!cashbox.isActive && <Badge variant="outline">{t('cashboxes.inactiveBadge')}</Badge>}
          </div>
          {cashbox.description && <p className="mt-0.5 text-xs text-muted-foreground">{cashbox.description}</p>}
        </div>
        <div className="flex flex-none gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('cashboxes.actions.edit')} onClick={onEdit}>
                <PencilIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('cashboxes.actions.edit')}</TooltipContent>
          </Tooltip>
          {cashbox.isActive ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={t('cashboxes.actions.deactivate')} onClick={onDeactivate}>
                  <PowerOffIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('cashboxes.actions.deactivate')}</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={t('cashboxes.actions.activate')} onClick={onActivate}>
                  <PowerIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('cashboxes.actions.activate')}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('cashboxes.actions.delete')} onClick={onDelete}>
                <Trash2Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('cashboxes.actions.delete')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">{t('cashboxes.balance')}</p>
        {balance === null ? (
          <p className="font-display text-2xl font-bold tabular-nums text-cashbox opacity-60" aria-label={t('cashboxes.balancePending')}>
            —
          </p>
        ) : (
          <p className="font-display text-2xl font-bold tabular-nums text-cashbox">{formatCents(balance)}</p>
        )}
      </div>

      {cashbox.targetAmount !== null && cashbox.targetAmount > 0 && (
        <div className="grid gap-1.5">
          {barProgress !== null && (
            <div role="progressbar" aria-valuenow={barProgress} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-accent">
              <div className={cn('h-full rounded-full', reached ? 'bg-primary' : 'bg-cashbox')} style={{ width: `${barProgress}%` }} />
            </div>
          )}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className={cn(reached && 'font-medium text-primary')}>{progress !== null ? t('cashboxes.goal.progress', { percent: progress }) : null}</span>
            <span className="tabular-nums">{t('cashboxes.goal.target', { amount: formatCents(cashbox.targetAmount) })}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
