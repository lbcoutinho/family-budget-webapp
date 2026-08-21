import {
  type RecurrenceRuleDto,
  getGetRecurrenceRuleQueryKey,
  getListRecurrenceRulesQueryKey,
  getListTransactionsQueryKey,
  useCreateInstallmentPlan,
  useCreateRecurrenceRule,
  useDeactivateRecurrenceRule,
  useCancelInstallmentPlan,
  useGenerateRecurrenceRule,
  useListAccounts,
  useListCategories,
  useListRecurrenceRules,
  useUpdateRecurrenceRule,
} from '@family-budget/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { CreditCardIcon, PlusIcon, RepeatIcon, TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { InstallmentDialog } from './installment-dialog';
import { RecurrenceDialog } from './recurrence-dialog';
import { RecurrenceList, RecurrenceListSkeleton } from './recurrence-list';
import { RecurrencesSummary } from './recurrences-summary';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { PageContent, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import i18n, { formKey } from '@/i18n';
import { apiErrorMessage } from '@/lib/api-error';

/** Active rules first, each group alphabetical — same convention as `sortCashboxes`. */
function sortRules(rules: RecurrenceRuleDto[]): RecurrenceRuleDto[] {
  return [...rules].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.description.localeCompare(b.description, i18n.language);
  });
}

export function RecurrencesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [showInactive, setShowInactive] = useState(false);
  const [ruleDialog, setRuleDialog] = useState<RecurrenceRuleDto | 'new' | null>(null);
  const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<RecurrenceRuleDto | null>(null);
  const [cancelling, setCancelling] = useState<RecurrenceRuleDto | null>(null);
  const [generatingId, setGeneratingId] = useState<string>();

  const { data: rules, isPending, isError, refetch } = useListRecurrenceRules(showInactive ? { includeInactive: true } : undefined);
  const { data: accounts = [] } = useListAccounts({ includeInactive: true });
  const { data: categories = [] } = useListCategories({ tree: true });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: getListRecurrenceRulesQueryKey() });

  const createRule = useCreateRecurrenceRule({
    mutation: {
      onSuccess: () => {
        invalidate();
        setRuleDialog(null);
      },
    },
  });
  const updateRule = useUpdateRecurrenceRule({
    mutation: {
      onSuccess: () => {
        invalidate();
        setRuleDialog(null);
      },
    },
  });
  const createInstallmentPlan = useCreateInstallmentPlan({
    mutation: {
      onSuccess: () => {
        invalidate();
        void queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        setInstallmentDialogOpen(false);
      },
    },
  });
  const deactivateRule = useDeactivateRecurrenceRule({
    mutation: {
      onSuccess: () => {
        invalidate();
        setDeactivating(null);
      },
    },
  });
  const cancelInstallments = useCancelInstallmentPlan({
    mutation: {
      onSuccess: (result) => {
        invalidate();
        void queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        setCancelling(null);
        toast.success(t(formKey('recurrences.cancelInstallments.success'), { count: result.deleted }));
      },
    },
  });
  const generateRule = useGenerateRecurrenceRule();

  const editingRule = ruleDialog === 'new' || ruleDialog === null ? undefined : ruleDialog;
  const ruleMutation = ruleDialog === 'new' ? createRule : updateRule;

  const handleGenerate = (rule: RecurrenceRuleDto) => {
    setGeneratingId(rule.id);
    generateRule.mutate(
      { id: rule.id },
      {
        onSuccess: (result) => {
          setGeneratingId(undefined);
          invalidate();
          void queryClient.invalidateQueries({ queryKey: getGetRecurrenceRuleQueryKey(rule.id) });
          void queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          if (result.created > 0) {
            toast.success(t(formKey('recurrences.generate.success'), { count: result.created }));
          } else {
            const date = result.generatedUntil ? new Intl.DateTimeFormat(i18n.language).format(new Date(`${result.generatedUntil}T00:00:00`)) : '';
            toast.info(t(formKey('recurrences.generate.nothingDescription'), { date }));
          }
        },
        onError: (error) => {
          setGeneratingId(undefined);
          toast.error(apiErrorMessage(error, t));
        },
      },
    );
  };

  const rulesList = rules ?? [];

  return (
    <>
      <PageHeader
        title={t('nav.recurrences')}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} aria-label={t(formKey('recurrences.showInactive'))} />
              {t(formKey('recurrences.showInactive'))}
            </label>
            <Button variant="outline" size="sm" onClick={() => setInstallmentDialogOpen(true)}>
              <CreditCardIcon />
              {t(formKey('recurrences.newInstallment'))}
            </Button>
            <Button size="sm" onClick={() => setRuleDialog('new')}>
              <PlusIcon />
              {t(formKey('recurrences.newRule'))}
            </Button>
          </>
        }
      />
      <PageContent>
        {!isPending && !isError && rulesList.length > 0 && <RecurrencesSummary rules={rulesList} />}
        {isPending && <RecurrenceListSkeleton />}
        {isError && (
          <EmptyState
            icon={TriangleAlertIcon}
            title={t(formKey('recurrences.error.title'))}
            description={t(formKey('recurrences.error.description'))}
            action={
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                {t('common.retry')}
              </Button>
            }
          />
        )}
        {!isPending && !isError && rulesList.length === 0 && (
          <EmptyState
            icon={RepeatIcon}
            title={t(formKey('recurrences.empty.title'))}
            description={t(formKey('recurrences.empty.description'))}
            action={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setInstallmentDialogOpen(true)}>
                  <CreditCardIcon />
                  {t(formKey('recurrences.newInstallment'))}
                </Button>
                <Button size="sm" onClick={() => setRuleDialog('new')}>
                  <PlusIcon />
                  {t(formKey('recurrences.newRule'))}
                </Button>
              </div>
            }
          />
        )}
        {!isPending && !isError && rulesList.length > 0 && (
          <RecurrenceList
            rules={sortRules(rulesList)}
            accounts={accounts}
            categories={categories}
            generatingId={generatingId}
            onEdit={setRuleDialog}
            onGenerate={handleGenerate}
            onDeactivate={setDeactivating}
            onCancelInstallments={setCancelling}
          />
        )}
      </PageContent>

      <RecurrenceDialog
        open={ruleDialog !== null}
        onOpenChange={(open) => {
          if (!open) setRuleDialog(null);
        }}
        rule={editingRule}
        isPending={ruleMutation.isPending}
        error={ruleMutation.error}
        onSubmit={(values) => {
          if (ruleDialog === 'new') {
            createRule.mutate({ data: values });
          } else if (ruleDialog !== null) {
            updateRule.mutate({ id: ruleDialog.id, data: values });
          }
        }}
      />

      <InstallmentDialog
        open={installmentDialogOpen}
        onOpenChange={setInstallmentDialogOpen}
        isPending={createInstallmentPlan.isPending}
        error={createInstallmentPlan.error}
        onSubmit={(values) => createInstallmentPlan.mutate({ data: values })}
      />

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title={t(formKey('recurrences.deactivate.title'), { name: deactivating?.description ?? '' })}
        description={t(formKey('recurrences.deactivate.description'))}
        confirmLabel={t(formKey('recurrences.deactivate.confirm'))}
        variant="default"
        isPending={deactivateRule.isPending}
        onConfirm={() => deactivating && deactivateRule.mutate({ id: deactivating.id })}
      />

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={t(formKey('recurrences.cancelInstallments.title'), { name: cancelling?.description ?? '' })}
        description={t(formKey('recurrences.cancelInstallments.description'))}
        confirmLabel={t(formKey('recurrences.cancelInstallments.confirm'))}
        variant="destructive"
        isPending={cancelInstallments.isPending}
        onConfirm={() => cancelling && cancelInstallments.mutate({ id: cancelling.id })}
      />
    </>
  );
}
