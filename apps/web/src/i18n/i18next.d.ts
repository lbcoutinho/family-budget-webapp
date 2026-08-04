import 'i18next';

import type ptBR from './locales/pt-BR.json';

// Types every `t('…')` call against the pt-BR file, so a mistyped or removed key is a compile
// error rather than the key itself rendered on the screen.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof ptBR };
  }
}
