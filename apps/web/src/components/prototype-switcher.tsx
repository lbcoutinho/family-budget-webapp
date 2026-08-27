import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';

interface PrototypeSwitcherProps {
  variants: { key: string; name: string }[];
  current: string;
}

export function PrototypeSwitcher({ variants, current }: PrototypeSwitcherProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentIndex = Math.max(
    0,
    variants.findIndex((variant) => variant.key === current),
  );

  const select = (offset: number) => {
    const next = variants[(currentIndex + offset + variants.length) % variants.length];
    if (!next) return;
    const params = new URLSearchParams(searchParams);
    params.set('variant', next.key);
    void navigate({ search: params.toString() }, { replace: true });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'ArrowLeft') select(-1);
      if (event.key === 'ArrowRight') select(1);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const currentVariant = variants[currentIndex] ?? variants[0];
  if (import.meta.env.PROD || !currentVariant) return null;

  return (
    <aside
      aria-label="Seletor de variante do protótipo"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-foreground/20 bg-foreground px-2 py-1.5 text-background shadow-lg"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Variante anterior"
        className="text-background hover:bg-background/15 hover:text-background"
        onClick={() => select(-1)}
      >
        <ChevronLeftIcon />
      </Button>
      <span className="min-w-44 text-center text-xs font-semibold">
        {currentVariant.key} — {currentVariant.name}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Próxima variante"
        className="text-background hover:bg-background/15 hover:text-background"
        onClick={() => select(1)}
      >
        <ChevronRightIcon />
      </Button>
    </aside>
  );
}
