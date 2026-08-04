import { type TFunction } from 'i18next';

import i18n, { type TranslationKey } from '@/i18n';

/**
 * Turns a rejected API call into a sentence in the user's language (M3-T11).
 *
 * The API answers business errors with `{ statusCode, code, message }`, where `message` is English
 * and meant for logs. Only the `code` is the contract: it selects `errors.<CODE>` from the locale
 * files. Anything unrecognised — a code added by a newer API, a network failure, an HTML error page
 * from a proxy — resolves to the generic string. The English `message` is never rendered.
 */
export function apiErrorMessage(error: unknown, t: TFunction): string {
  const code = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code;
  const key = `errors.${String(code)}`;

  // `exists` is the only way to ask i18next about a key it may not have; the cast is what lets a
  // runtime string reach `t`, whose keys are typed from the pt-BR file.
  return i18n.exists(key) ? t(key as TranslationKey) : t('errors.UNKNOWN');
}
