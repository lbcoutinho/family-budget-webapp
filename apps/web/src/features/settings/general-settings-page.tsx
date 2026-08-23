import {
  axiosInstance,
  type AuthUserDto,
  type CsvImportModelDto,
  type SessionDto,
  getListCsvImportModelsQueryKey,
  useCreateCsvImportModel,
  useDeleteCsvImportModel,
  useListCsvImportModels,
  useUpdateCurrentUser,
} from '@family-budget/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DownloadIcon, Loader2Icon, PlusIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { CsvImportModelDialog } from './csv-import-model-dialog';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageContent, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { SESSION_QUERY_KEY } from '@/features/auth/auth-provider';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale, type TranslationKey } from '@/i18n';
import { apiErrorMessage } from '@/lib/api-error';

const LOCALE_LABEL_KEY: Record<SupportedLocale, TranslationKey> = {
  'pt-BR': 'settingsGeneral.language.options.pt-BR',
  'en-US': 'settingsGeneral.language.options.en-US',
};

/**
 * A field, not a form: the `Select` saves on change, so there is no "Salvar" button and no dirty
 * state to track. A failed save is never shown mid-flight — the value simply stays at whatever the
 * session cache holds, which is the previous locale until the mutation proves otherwise.
 */
export function GeneralSettingsPage() {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [createModelOpen, setCreateModelOpen] = useState(false);
  const [deletingModel, setDeletingModel] = useState<CsvImportModelDto | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);

  const locale = user?.locale ?? DEFAULT_LOCALE;

  const updateLocale = useUpdateCurrentUser({
    mutation: {
      onSuccess: (updated: AuthUserDto) => {
        queryClient.setQueryData<SessionDto | null>(SESSION_QUERY_KEY, (session) => (session ? { ...session, user: updated } : session));
        toast.success(t('settingsGeneral.language.success', { locale: t(LOCALE_LABEL_KEY[updated.locale]) }));
      },
      onError: () => setFailed(true),
    },
  });

  const handleChange = (value: SupportedLocale) => {
    setFailed(false);
    updateLocale.mutate({ data: { locale: value } });
  };

  const backup = useMutation({
    mutationFn: () => axiosInstance.get<Blob>('/backups/database', { responseType: 'blob' }),
    onSuccess: ({ data, headers }) => {
      const filename = /filename="?([^";]+)"?/i.exec(String(headers['content-disposition'] ?? ''))?.[1] ?? 'family-budget-backup.dump';
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url));
      setBackupDialogOpen(false);
    },
    onError: (error) => {
      const status = (error as { response?: { status?: number } }).response?.status;
      const message =
        status === 503
          ? t('settingsGeneral.backup.errors.postgresClient')
          : status === 409
            ? t('settingsGeneral.backup.errors.inProgress')
            : apiErrorMessage(error, t);

      toast.error(message);
      setBackupDialogOpen(false);
    },
  });
  const models = useListCsvImportModels();
  const invalidateModels = () => void queryClient.invalidateQueries({ queryKey: getListCsvImportModelsQueryKey() });
  const createModel = useCreateCsvImportModel({
    mutation: {
      onSuccess: () => {
        invalidateModels();
        setCreateModelOpen(false);
      },
    },
  });
  const deleteModel = useDeleteCsvImportModel({
    mutation: {
      onSuccess: () => {
        invalidateModels();
        setDeletingModel(null);
      },
      onError: (error) => toast.error(apiErrorMessage(error, t)),
    },
  });

  return (
    <>
      <PageHeader title={t('nav.settingsGeneral')} />
      <PageContent>
        <Card className="max-w-[620px] p-4">
          <div className="grid grid-cols-[minmax(120px,1.5fr)_minmax(0,1fr)] items-center gap-x-3.5 gap-y-1.5">
            <span className="text-sm font-medium">{t('settingsGeneral.language.label')}</span>
            <Select value={locale} disabled={updateLocale.isPending} onValueChange={(value) => handleChange(value as SupportedLocale)}>
              <SelectTrigger id="settings-language" className="w-40" aria-label={t('settingsGeneral.language.label')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LOCALES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(LOCALE_LABEL_KEY[option])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {updateLocale.isPending && <p className="col-span-2 text-xs text-muted-foreground">{t('settingsGeneral.language.saving')}</p>}
            {failed && !updateLocale.isPending && (
              <p className="col-span-2 text-xs text-destructive">{t('settingsGeneral.language.error', { locale: t(LOCALE_LABEL_KEY[locale]) })}</p>
            )}
            {!failed && !updateLocale.isPending && <p className="col-span-2 text-xs text-muted-foreground">{t('settingsGeneral.language.note')}</p>}
          </div>
        </Card>
        <section className="mt-7 max-w-[620px]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[1.05rem] font-semibold tracking-[-0.02em]">{t('settingsGeneral.models.heading')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('settingsGeneral.models.description')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setCreateModelOpen(true)}>
              <PlusIcon />
              {t('settingsGeneral.models.create')}
            </Button>
          </div>
          {models.isPending ? (
            <Card className="grid gap-3 p-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </Card>
          ) : models.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {t('settingsGeneral.models.error')}{' '}
              <Button variant="link" size="sm" onClick={() => void models.refetch()}>
                {t('common.retry')}
              </Button>
            </p>
          ) : models.data?.length ? (
            <Card className="divide-y p-0">
              {models.data.map((model) => (
                <div key={model.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{model.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {t(`settingsGeneral.models.separators.${model.separator === '\t' ? 'tab' : model.separator === ';' ? 'semicolon' : 'comma'}`)} ·{' '}
                      {t('settingsGeneral.models.headerLines', { count: model.headerLineCount })} · {model.dateHeader} · {model.descriptionHeader} ·{' '}
                      {model.amountHeader}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('settingsGeneral.models.delete.button', { name: model.name })}
                    onClick={(event) => {
                      deleteTriggerRef.current = event.currentTarget;
                      setDeletingModel(model);
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">{t('settingsGeneral.models.empty')}</p>
          )}
        </section>
        {isAdmin && (
          <section className="mt-7">
            <h2 className="mb-3 font-display text-[1.05rem] font-semibold tracking-[-0.02em]">{t('settingsGeneral.backup.adminHeading')}</h2>
            <Card className="max-w-[620px] p-4">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <h3 className="text-sm font-medium">{t('settingsGeneral.backup.heading')}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t('settingsGeneral.backup.description')}</p>
                </div>
                <Button variant="outline" size="sm" disabled={backup.isPending} onClick={() => setBackupDialogOpen(true)}>
                  {backup.isPending ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
                  {t('settingsGeneral.backup.action')}
                </Button>
              </div>
              {backup.isPending && <p className="mt-3 text-xs text-muted-foreground">{t('settingsGeneral.backup.loading')}</p>}
            </Card>
            <ConfirmDialog
              open={backupDialogOpen}
              onOpenChange={setBackupDialogOpen}
              title={t('settingsGeneral.backup.confirm.title')}
              description={
                <div className="grid gap-3">
                  <p role="note" className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-950">
                    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                    <span>{t('settingsGeneral.backup.warning')}</span>
                  </p>
                  {backup.isPending && <p>{t('settingsGeneral.backup.loading')}</p>}
                </div>
              }
              confirmLabel={t('settingsGeneral.backup.confirm.action')}
              isPending={backup.isPending}
              onConfirm={() => backup.mutate()}
            />
          </section>
        )}
      </PageContent>
      <CsvImportModelDialog
        open={createModelOpen}
        onOpenChange={setCreateModelOpen}
        isPending={createModel.isPending}
        error={createModel.error}
        onSubmit={(data) => createModel.mutate({ data })}
      />
      <ConfirmDialog
        open={deletingModel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingModel(null);
            setTimeout(() => deleteTriggerRef.current?.focus());
          }
        }}
        title={t('settingsGeneral.models.delete.title', { name: deletingModel?.name })}
        description={t('settingsGeneral.models.delete.description')}
        confirmLabel={t('settingsGeneral.models.delete.confirm', { name: deletingModel?.name })}
        variant="destructive"
        isPending={deleteModel.isPending}
        onConfirm={() => deletingModel && deleteModel.mutate({ id: deletingModel.id })}
      />
    </>
  );
}
