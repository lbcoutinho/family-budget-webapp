import { CalendarIcon, ChartColumnIcon, type LucideIcon, MicIcon, PiggyBankIcon, RepeatIcon, TagsIcon, WalletIcon } from 'lucide-react';

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

/** The two registries. Set up rarely, so they live one level down, behind Configurações. */
export const SETTINGS_NAV_ITEMS: NavItem[] = [
  { to: '/accounts', labelKey: 'nav.accounts', icon: WalletIcon },
  { to: '/categories', labelKey: 'nav.categories', icon: TagsIcon },
];
