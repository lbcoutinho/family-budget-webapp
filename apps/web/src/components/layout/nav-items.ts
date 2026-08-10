import { CalendarIcon, ChartColumnIcon, type LucideIcon, MicIcon, PiggyBankIcon, RepeatIcon, TagsIcon, UserRoundCogIcon, WalletIcon } from 'lucide-react';

import { type TranslationKey } from '@/i18n';

export interface NavItem {
  to: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
}

/**
 * The everyday work, in the order the shell prototype settled: Caixinhas sits directly below Mês
 * rather than under Configurações, because it is visited while running the month rather than set
 * up once. Recorrências stays at this level for the same reason.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/month', labelKey: 'nav.month', icon: CalendarIcon },
  { to: '/cashboxes', labelKey: 'nav.cashboxes', icon: PiggyBankIcon },
  { to: '/reports', labelKey: 'nav.reports', icon: ChartColumnIcon },
  { to: '/voice', labelKey: 'nav.voice', icon: MicIcon },
  { to: '/recurrences', labelKey: 'nav.recurrences', icon: RepeatIcon },
];

/** Geral first: it is where every future account-wide preference (theme, date format) lands, so it
 * sits above the two registries rather than joining them alphabetically. */
export const SETTINGS_NAV_ITEMS: NavItem[] = [
  { to: '/settings/general', labelKey: 'nav.settingsGeneral', icon: UserRoundCogIcon },
  { to: '/accounts', labelKey: 'nav.accounts', icon: WalletIcon },
  { to: '/categories', labelKey: 'nav.categories', icon: TagsIcon },
];
