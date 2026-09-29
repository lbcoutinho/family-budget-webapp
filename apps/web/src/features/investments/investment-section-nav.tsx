import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils';

const sections = [
  ['/investments/overview', 'investmentOverview.title'],
  ['/investments/operations', 'investmentTrades.title'],
  ['/investments/flow', 'investmentFlow.title'],
  ['/investments/import', 'investmentImport.title'],
] as const;

/** One navigation surface keeps the section state identical across investment routes. */
export function InvestmentSectionNav() {
  const { t } = useTranslation();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label={t('investmentOverview.sections')}>
      {sections.map(([to, label]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn('border-b-2 px-3 py-2 text-sm', isActive ? 'border-foreground font-medium' : 'border-transparent text-muted-foreground')
          }
        >
          {t(label)}
        </NavLink>
      ))}
    </nav>
  );
}
