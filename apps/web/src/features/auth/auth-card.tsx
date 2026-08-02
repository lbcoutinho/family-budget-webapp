import { type ReactNode } from 'react';

import { Card } from '@/components/ui/card';

/**
 * The card the authentication screens live in: one narrow, centred box with the mark on top.
 *
 * Shared by the login form and the "restoring the session" state on purpose — the approved
 * prototype (`prototypes/approved/01-login.html`) settles that the two occupy the same card in the
 * same place, so swapping one for the other moves nothing on the page.
 */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-svh place-items-center px-5 pt-7 pb-14">
      <Card className="w-full max-w-[366px] gap-0 rounded-[14px] px-7 pt-[30px] pb-[26px] shadow-[0_4px_14px_rgba(20,22,26,0.08)] duration-[260ms] animate-in fade-in slide-in-from-bottom-2">
        <div className="mb-[22px] flex items-center gap-2.5">
          <BrandMark />
          <h1 className="text-[1.3rem] tracking-[-0.03em]">Orçamento</h1>
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
    <span aria-hidden className="grid grid-cols-2 gap-[3px]">
      {['--category-1', '--category-3', '--category-2', '--category-5'].map((token) => (
        <i key={token} className="size-[9px] rounded-[2px]" style={{ background: `var(${token})` }} />
      ))}
    </span>
  );
}
