import { useTranslation } from 'react-i18next';

import { type TranslationKey } from '@/i18n';

export function FieldError({ id, error }: { id?: string; error?: string }) {
  const { t } = useTranslation();
  return error ? (
    <p id={id} className="text-xs text-destructive">
      {t(error as TranslationKey)}
    </p>
  ) : null;
}
