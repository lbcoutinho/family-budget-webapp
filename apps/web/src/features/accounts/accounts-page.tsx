import {
  type AccountDto,
  useActivateAccount,
  useCreateAccount,
  useDeactivateAccount,
  useDeleteAccount,
  useListAccountBalances,
  useListAccounts,
  useUpdateAccount,
} from '@family-budget/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { PlusIcon, TriangleAlertIcon, WalletIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AccountDialog } from './account-dialog';
import { AccountsTable, AccountsTableSkeleton } from './accounts-table';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { PageContent, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import i18n from '@/i18n';
import { apiErrorMessage } from '@/lib/api-error';
import { formatCents } from '@/lib/money';

/** All five mutations invalidate the same prefix, which hits both the active-only and the
 * include-inactive cache entries — no per-params keys, no optimistic updates. */
const ACCOUNTS_QUERY_KEY = ['/accounts'];

/** Active accounts first, each group alphabetical — inactive accounts sit at the bottom of the
 * list, dimmed, per the approved prototype. */
function sortAccounts(accounts: AccountDto[]): AccountDto[] {
  return [...accounts].sort((a, b) => {
    if (a.isActive !== b.isActive) {
      return a.isActive ? -1 : 1;
    }

    return a.name.localeCompare(b.name, i18n.language);
  });
}

export function AccountsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [showInactive, setShowInactive] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountDto | 'new' | null>(null);
  const [deactivating, setDeactivating] = useState<AccountDto | null>(null);
  const [deactivationBalance, setDeactivationBalance] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<AccountDto | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);

  const { data: accounts, isPending, isError, refetch } = useListAccounts(showInactive ? { includeInactive: true } : undefined);
  const balances = useListAccountBalances(undefined, { query: { staleTime: 30_000 } });
  const balanceByAccountId = useMemo(() => new Map((balances.data ?? []).map((balance) => [balance.accountId, balance.balance])), [balances.data]);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });

  const createAccount = useCreateAccount({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEditingAccount(null);
      },
    },
  });
  const updateAccount = useUpdateAccount({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEditingAccount(null);
      },
    },
  });
  const activateAccount = useActivateAccount({ mutation: { onSuccess: invalidate } });
  const deactivateAccount = useDeactivateAccount({
    mutation: {
      onSuccess: () => {
        invalidate();
        setDeactivating(null);
        setDeactivationBalance(null);
      },
      onError: (error) => {
        const data = (error as { response?: { data?: { balance?: unknown; code?: unknown } } } | null)?.response?.data;
        if (data?.code === 'ACCOUNT_NOT_EMPTY' && typeof data.balance === 'number') {
          setDeactivationBalance(data.balance);
          setDeactivating((current) => current ?? deleting);
          setDeleting(null);
          setDeleteBlocked(false);
        }
      },
    },
  });
  const deleteAccount = useDeleteAccount({
    mutation: {
      onSuccess: () => {
        invalidate();
        setDeleting(null);
        setDeleteBlocked(false);
      },
      onError: (error) => {
        if ((error as { response?: { data?: { code?: string } } }).response?.data?.code === 'RECORD_IN_USE') {
          setDeleteBlocked(true);

          return;
        }

        // Anything else is unexpected — close and let the row stay exactly as it was.
        setDeleting(null);
      },
    },
  });

  const dialogAccount = editingAccount === 'new' || editingAccount === null ? undefined : editingAccount;
  const dialogMutation = editingAccount === 'new' ? createAccount : updateAccount;

  return (
    <>
      <PageHeader
        title={t('nav.accounts')}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} aria-label={t('accounts.showInactive')} />
              {t('accounts.showInactive')}
            </label>
            <Button size="sm" onClick={() => setEditingAccount('new')}>
              <PlusIcon />
              {t('accounts.new')}
            </Button>
          </>
        }
      />
      <PageContent>
        <Card className="py-0">
          {isPending && <AccountsTableSkeleton />}
          {isError && (
            <EmptyState
              icon={TriangleAlertIcon}
              title={t('accounts.error.title')}
              description={t('accounts.error.description')}
              action={
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  {t('common.retry')}
                </Button>
              }
            />
          )}
          {!isPending && !isError && accounts.length === 0 && (
            <EmptyState
              icon={WalletIcon}
              title={t('accounts.empty.title')}
              description={t('accounts.empty.description')}
              action={
                <Button size="sm" onClick={() => setEditingAccount('new')}>
                  <PlusIcon />
                  {t('accounts.new')}
                </Button>
              }
            />
          )}
          {!isPending && !isError && accounts.length > 0 && (
            <AccountsTable
              accounts={sortAccounts(accounts)}
              balances={balanceByAccountId}
              balancesLoading={balances.isPending}
              onEdit={setEditingAccount}
              onDeactivate={(account) => {
                setDeactivationBalance(null);
                setDeactivating(account);
              }}
              onActivate={(account) => activateAccount.mutate({ id: account.id })}
              onDelete={(account) => {
                setDeleting(account);
                setDeleteBlocked(false);
              }}
            />
          )}
        </Card>
      </PageContent>

      <AccountDialog
        open={editingAccount !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingAccount(null);
          }
        }}
        account={dialogAccount}
        isPending={dialogMutation.isPending}
        error={dialogMutation.error}
        onSubmit={(values) => {
          if (editingAccount === 'new') {
            createAccount.mutate({ data: values });
          } else if (editingAccount !== null) {
            updateAccount.mutate({ id: editingAccount.id, data: values });
          }
        }}
      />

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivating(null);
            setDeactivationBalance(null);
          }
        }}
        title={deactivationBalance === null ? t('accounts.deactivate.title', { name: deactivating?.name ?? '' }) : t('accounts.deactivate.blockedTitle')}
        description={
          deactivationBalance === null
            ? t('accounts.deactivate.description')
            : t('accounts.deactivate.blockedDescription', { amount: formatCents(deactivationBalance) })
        }
        confirmLabel={deactivationBalance === null ? t('accounts.deactivate.confirm') : t('common.close')}
        cancelLabel={deactivationBalance === null ? undefined : t('common.close')}
        isPending={deactivateAccount.isPending}
        onConfirm={() => {
          if (deactivationBalance !== null) {
            setDeactivating(null);
            setDeactivationBalance(null);
          } else if (deactivating) {
            deactivateAccount.mutate({ id: deactivating.id });
          }
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteBlocked(false);
          }
        }}
        title={deleteBlocked ? t('accounts.delete.blockedTitle') : t('accounts.delete.title', { name: deleting?.name ?? '' })}
        description={deleteBlocked ? apiErrorMessage(deleteAccount.error, t) : t('accounts.delete.description')}
        confirmLabel={deleteBlocked ? t('accounts.actions.deactivate') : t('accounts.delete.confirm')}
        cancelLabel={deleteBlocked ? t('common.close') : undefined}
        variant={deleteBlocked ? 'default' : 'destructive'}
        isPending={deleteAccount.isPending || deactivateAccount.isPending}
        onConfirm={() => {
          if (!deleting) {
            return;
          }

          if (deleteBlocked) {
            deactivateAccount.mutate(
              { id: deleting.id },
              {
                onSuccess: () => {
                  setDeleting(null);
                  setDeleteBlocked(false);
                },
              },
            );

            return;
          }

          deleteAccount.mutate({ id: deleting.id });
        }}
      />
    </>
  );
}
