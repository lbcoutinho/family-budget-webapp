import { CompassIcon, HammerIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/empty-state';
import { PageContent, PageHeader } from '@/components/page-header';
import { type TranslationKey } from '@/i18n';

export interface RoutePlaceholderProps {
  titleKey: TranslationKey;
  /** The ticket that replaces this with the real screen, so the gap is dated rather than silent. */
  ticket: string;
}

/**
 * What every route renders until its own screen ships. The shell is built before the screens on
 * purpose — the alternative is reworking the structure under each of them — so this is the dashed
 * rectangle the shell prototype draws where the content goes, and nothing more.
 */
export function RoutePlaceholder({ titleKey, ticket }: RoutePlaceholderProps) {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader title={t(titleKey)} />
      <PageContent>
        <EmptyState icon={HammerIcon} title={t('placeholder.routeTitle')} description={t('placeholder.routeDescription', { ticket })} />
      </PageContent>
    </>
  );
}

/** A mistyped address, kept inside the shell so the navigation is right there to recover with. */
export function NotFoundPlaceholder() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader title={t('placeholder.notFound.title')} />
      <PageContent>
        <EmptyState icon={CompassIcon} title={t('placeholder.notFound.heading')} description={t('placeholder.notFound.description')} />
      </PageContent>
    </>
  );
}
