import { type AuthUserDto, useUpdateCurrentUser } from '@family-budget/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { PageContent, PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/features/auth/auth-context';
import { SESSION_QUERY_KEY } from '@/features/auth/auth-provider';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale, type TranslationKey } from '@/i18n';

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);

  const locale = user?.locale ?? DEFAULT_LOCALE;

  const updateLocale = useUpdateCurrentUser({
    mutation: {
      onSuccess: (updated: AuthUserDto) => {
        queryClient.setQueryData(SESSION_QUERY_KEY, updated);
        toast.success(t('settingsGeneral.language.success', { locale: t(LOCALE_LABEL_KEY[updated.locale]) }));
      },
      onError: () => setFailed(true),
    },
  });

  const handleChange = (value: SupportedLocale) => {
    setFailed(false);
    updateLocale.mutate({ data: { locale: value } });
  };

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
      </PageContent>
    </>
  );
}
