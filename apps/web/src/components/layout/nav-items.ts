import { CalendarIcon, ChartColumnIcon, type LucideIcon, MicIcon, PiggyBankIcon, RepeatIcon, TagsIcon, WalletIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The everyday work, in the order the shell prototype settled: Caixinhas sits directly below Mês
 * rather than under Configurações, because it is visited while running the month rather than set
 * up once. Recorrências stays at this level for the same reason.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/month', label: 'Mês', icon: CalendarIcon },
  { to: '/cashboxes', label: 'Caixinhas', icon: PiggyBankIcon },
  { to: '/reports', label: 'Relatórios', icon: ChartColumnIcon },
  { to: '/voice', label: 'Lançar por voz', icon: MicIcon },
  { to: '/recurrences', label: 'Recorrências', icon: RepeatIcon },
];

/** The two registries. Set up rarely, so they live one level down, behind Configurações. */
export const SETTINGS_NAV_ITEMS: NavItem[] = [
  { to: '/accounts', label: 'Contas', icon: WalletIcon },
  { to: '/categories', label: 'Categorias', icon: TagsIcon },
];
