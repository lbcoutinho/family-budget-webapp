import { axiosInstance, type AuthUserDto, type SessionDto, useUpdateCurrentUser } from '@family-budget/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DownloadIcon, Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageContent, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

  return (
    <>
      <PageHeader title={t('nav.settingsGeneral')} />
      <PageContent>
        <h2 className="mb-1.5 font-display text-[1.05rem] font-semibold tracking-[-0.02em]">{t('settingsGeneral.language.heading')}</h2>
        <p className="mb-3 max-w-[72ch] text-sm text-muted-foreground">{t('settingsGeneral.language.description')}</p>
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
                  <p className="text-destructive">{t('settingsGeneral.backup.warning')}</p>
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
    </>
  );
}
