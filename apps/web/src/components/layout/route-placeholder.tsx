import { CompassIcon, HammerIcon } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { PageContent, PageHeader } from '@/components/page-header';

export interface RoutePlaceholderProps {
  title: string;
  /** The ticket that replaces this with the real screen, so the gap is dated rather than silent. */
  ticket: string;
}

/**
 * What every route renders until its own screen ships. The shell is built before the screens on
 * purpose — the alternative is reworking the structure under each of them — so this is the dashed
 * rectangle the shell prototype draws where the content goes, and nothing more.
 */
export function RoutePlaceholder({ title, ticket }: RoutePlaceholderProps) {
  return (
    <>
      <PageHeader title={title} />
      <PageContent>
        <EmptyState icon={HammerIcon} title="Conteúdo da rota" description={`Esta tela chega em ${ticket}. Por enquanto existe só a moldura à volta dela.`} />
      </PageContent>
    </>
  );
}

/** A mistyped address, kept inside the shell so the navigation is right there to recover with. */
export function NotFoundPlaceholder() {
  return (
    <>
      <PageHeader title="Página não encontrada" />
      <PageContent>
        <EmptyState icon={CompassIcon} title="Este endereço não existe" description="Escolha uma das telas no menu para continuar." />
      </PageContent>
    </>
  );
}
