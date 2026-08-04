import { type AccountDto } from '@family-budget/api-client';
import { PencilIcon, PowerIcon, PowerOffIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** "Millennium" → "MI", "Conta Corrente" → "CC". Two letters, no icon set distinguishes a list of banks. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/);

  return words.length > 1 ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}

export interface AccountsTableProps {
  accounts: AccountDto[];
  onEdit: (account: AccountDto) => void;
  onDeactivate: (account: AccountDto) => void;
  onActivate: (account: AccountDto) => void;
  onDelete: (account: AccountDto) => void;
}

export function AccountsTableSkeleton() {
  const { t } = useTranslation();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('accounts.columns.name')}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {[130, 96, 118].map((width) => (
          <TableRow key={width}>
            <TableCell>
              <Skeleton className="h-4" style={{ width }} />
            </TableCell>
            <TableCell />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Rows and their per-row actions. Sorting and data fetching live in the page above this. */
export function AccountsTable({ accounts, onEdit, onDeactivate, onActivate, onDelete }: AccountsTableProps) {
  const { t } = useTranslation();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('accounts.columns.name')}</TableHead>
          <TableHead>
            <span className="sr-only">{t('common.actions')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {accounts.map((account) => (
          <TableRow key={account.id} className={cn(!account.isActive && 'text-muted-foreground')}>
            <TableCell>
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'grid size-7 flex-none place-items-center rounded-md border border-border bg-muted text-[11px] font-semibold',
                    !account.isActive && 'text-muted-foreground/70',
                  )}
                >
                  {initials(account.name)}
                </span>
                <span className={cn('font-medium', !account.isActive && 'font-normal')}>{account.name}</span>
                {!account.isActive && <Badge variant="outline">{t('accounts.inactiveBadge')}</Badge>}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={t('common.edit')} onClick={() => onEdit(account)}>
                      <PencilIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('common.edit')}</TooltipContent>
                </Tooltip>
                {account.isActive ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={t('accounts.actions.deactivate')} onClick={() => onDeactivate(account)}>
                        <PowerOffIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('accounts.actions.deactivate')}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={t('accounts.actions.activate')} onClick={() => onActivate(account)}>
                        <PowerIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('accounts.actions.activate')}</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={t('common.delete')} onClick={() => onDelete(account)}>
                      <Trash2Icon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('common.delete')}</TooltipContent>
                </Tooltip>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
