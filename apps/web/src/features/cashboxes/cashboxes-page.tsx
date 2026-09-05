import {
  type CashboxDto,
  getListCashboxesQueryKey,
  useActivateCashbox,
  useCreateCashbox,
  useDeactivateCashbox,
  useDeleteCashbox,
  useListCashboxes,
  useListCashboxBalances,
  useUpdateCashbox,
} from '@family-budget/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { PiggyBankIcon, PlusIcon, TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CashboxCard, CashboxGridSkeleton } from './cashbox-card';
import { CashboxDialog } from './cashbox-dialog';
import { CashboxesSummary } from './cashboxes-summary';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { PageContent, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import i18n from '@/i18n';
import { apiErrorMessage } from '@/lib/api-error';
import { formatDateOnly } from '@/lib/date';

function apiErrorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { code?: string } } } | null)?.response?.data?.code;
}

/** Active cashboxes first, each group alphabetical — same convention as `sortAccounts`. */
function sortCashboxes(cashboxes: CashboxDto[]): CashboxDto[] {
  return [...cashboxes].sort((a, b) => {
    if (a.isActive !== b.isActive) {
      return a.isActive ? -1 : 1;
    }

    return a.name.localeCompare(b.name, i18n.language);
  });
}

export function CashboxesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<CashboxDto | 'new' | null>(null);
  const [deactivating, setDeactivating] = useState<CashboxDto | null>(null);
  const [activating, setActivating] = useState<CashboxDto | null>(null);
  const [deleting, setDeleting] = useState<CashboxDto | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);

  const {
    data: cashboxes,
    isPending: cashboxesPending,
    isError: cashboxesError,
    refetch: refetchCashboxes,
  } = useListCashboxes(showInactive ? { includeInactive: true } : undefined);
  const {
    data: balances,
    isPending: balancesPending,
    isError: balancesError,
    refetch: refetchBalances,
  } = useListCashboxBalances({ asOf: formatDateOnly(new Date()) });
  const isPending = cashboxesPending || balancesPending;
  const isError = cashboxesError || balancesError;
  const balanceByCashboxId = new Map(balances?.map(({ cashboxId, balance }) => [cashboxId, balance]));

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: getListCashboxesQueryKey() });

  const createCashbox = useCreateCashbox({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEditing(null);
      },
    },
  });
  const updateCashbox = useUpdateCashbox({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEditing(null);
      },
    },
  });
  const activateCashbox = useActivateCashbox({
    mutation: {
      onSuccess: () => {
        invalidate();
        setActivating(null);
      },
    },
  });
  const deactivateCashbox = useDeactivateCashbox({
    mutation: {
      onSuccess: () => {
        invalidate();
        setDeactivating(null);
      },
    },
  });
  const deleteCashbox = useDeleteCashbox({
    mutation: {
      onSuccess: () => {
        invalidate();
        setDeleting(null);
        setDeleteBlocked(false);
      },
      onError: (error) => {
        if (apiErrorCode(error) === 'CASHBOX_NOT_EMPTY') {
          setDeleteBlocked(true);

          return;
        }

        // Anything else is unexpected — close and let the card stay exactly as it was.
        setDeleting(null);
      },
    },
  });

  const dialogCashbox = editing === 'new' || editing === null ? undefined : editing;
  const dialogMutation = editing === 'new' ? createCashbox : updateCashbox;

  return (
    <>
      <PageHeader
        title={t('nav.cashboxes')}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} aria-label={t('cashboxes.showInactive')} />
              {t('cashboxes.showInactive')}
            </label>
            <Button size="sm" onClick={() => setEditing('new')}>
              <PlusIcon />
              {t('cashboxes.new')}
            </Button>
          </>
        }
      />
      <PageContent>
        {!isPending && !isError && cashboxes.length > 0 && <CashboxesSummary month={new Date()} activeCount={cashboxes.filter((c) => c.isActive).length} />}
        {isPending && <CashboxGridSkeleton />}
        {isError && (
          <EmptyState
            icon={TriangleAlertIcon}
            title={t('cashboxes.error.title')}
            description={t('cashboxes.error.description')}
            action={
              <Button variant="outline" size="sm" onClick={() => void Promise.all([refetchCashboxes(), refetchBalances()])}>
                {t('common.retry')}
              </Button>
            }
          />
        )}
        {!isPending && !isError && cashboxes.length === 0 && (
          <EmptyState
            icon={PiggyBankIcon}
            title={t('cashboxes.empty.title')}
            description={t('cashboxes.empty.description')}
            action={
              <Button size="sm" onClick={() => setEditing('new')}>
                <PlusIcon />
                {t('cashboxes.new')}
              </Button>
            }
          />
        )}
        {!isPending && !isError && cashboxes.length > 0 && (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))' }}>
            {sortCashboxes(cashboxes).map((cashbox) => (
              <CashboxCard
                key={cashbox.id}
                cashbox={cashbox}
                balance={balanceByCashboxId.get(cashbox.id) ?? null}
                onEdit={() => setEditing(cashbox)}
                onDeactivate={() => setDeactivating(cashbox)}
                onActivate={() => setActivating(cashbox)}
                onDelete={() => {
                  setDeleting(cashbox);
                  setDeleteBlocked(false);
                }}
              />
            ))}
          </div>
        )}
      </PageContent>

      <CashboxDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
          }
        }}
        cashbox={dialogCashbox}
        isPending={dialogMutation.isPending}
        error={dialogMutation.error}
        onSubmit={(values) => {
          if (editing === 'new') {
            createCashbox.mutate({ data: values });
          } else if (editing !== null) {
            updateCashbox.mutate({ id: editing.id, data: values });
          }
        }}
      />

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title={t('cashboxes.deactivate.title', { name: deactivating?.name ?? '' })}
        description={t('cashboxes.deactivate.description', { name: deactivating?.name ?? '' })}
        confirmLabel={t('cashboxes.deactivate.confirm')}
        variant="default"
        isPending={deactivateCashbox.isPending}
        onConfirm={() => deactivating && deactivateCashbox.mutate({ id: deactivating.id })}
      />

      <ConfirmDialog
        open={activating !== null}
        onOpenChange={(open) => !open && setActivating(null)}
        title={t('cashboxes.activate.title', { name: activating?.name ?? '' })}
        description={t('cashboxes.activate.description')}
        confirmLabel={t('cashboxes.activate.confirm')}
        variant="default"
        isPending={activateCashbox.isPending}
        onConfirm={() => activating && activateCashbox.mutate({ id: activating.id })}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteBlocked(false);
          }
        }}
        title={deleteBlocked ? t('cashboxes.delete.blockedTitle') : t('cashboxes.delete.title', { name: deleting?.name ?? '' })}
        description={deleteBlocked ? apiErrorMessage(deleteCashbox.error, t) : t('cashboxes.delete.description')}
        confirmLabel={deleteBlocked ? t('cashboxes.actions.deactivate') : t('cashboxes.delete.confirm')}
        cancelLabel={deleteBlocked ? t('common.close') : undefined}
        variant={deleteBlocked ? 'default' : 'destructive'}
        isPending={deleteCashbox.isPending || deactivateCashbox.isPending}
        onConfirm={() => {
          if (!deleting) {
            return;
          }

          if (deleteBlocked) {
            deactivateCashbox.mutate(
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

          deleteCashbox.mutate({ id: deleting.id });
        }}
      />
    </>
  );
}
