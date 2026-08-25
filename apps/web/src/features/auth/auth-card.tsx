import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';

/**
 * The card the authentication screens live in: one narrow, centred box with the mark on top.
 *
 * Shared by the login form and the "restoring the session" state on purpose — the approved
 * prototype (`prototypes/approved/01-login.html`) settles that the two occupy the same card in the
 * same place, so swapping one for the other moves nothing on the page.
 */
export function AuthCard({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <main className="grid min-h-svh place-items-center px-5 pt-7 pb-14">
      <Card className="w-full max-w-auth-card gap-0 rounded-xl px-7 pt-auth-card-top pb-auth-card-bottom shadow-raised duration-auth-card animate-in fade-in slide-in-from-bottom-2">
        <div className="mb-content flex items-center gap-2.5">
          <BrandMark />
          <h1 className="text-auth-brand tracking-brand">{t('app.name')}</h1>
        </div>
        {children}
      </Card>
    </main>
  );
}

/**
 * Four category swatches in a square. There is no brand colour in this design system, so the mark
 * is the palette itself — the only colour on the screen besides the primary button.
 */
function BrandMark() {
  return (
    <span aria-hidden className="grid grid-cols-2 gap-auth-brand-gap">
      {['--category-1', '--category-3', '--category-2', '--category-5'].map((token) => (
        <i key={token} className="size-auth-brand-mark rounded-mark" style={{ background: `var(${token})` }} />
      ))}
    </span>
  );
}
