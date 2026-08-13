import { Navigate, useParams } from 'react-router-dom';

import { PageContent, PageHeader } from '@/components/page-header';
import { currentMonthPath, formatMonth, monthFromPathParams } from '@/lib/date';

/**
 * The monthly route owns the reference-month boundary. The transaction table is added in the
 * subsequent ticket steps; keeping this page valid now gives every child feature one stable URL.
 */
export function MonthPage() {
  const { year, month } = useParams();
  const referenceMonth = monthFromPathParams(year, month);

  if (!referenceMonth) {
    return <Navigate to={currentMonthPath()} replace />;
  }

  return (
    <>
      <PageHeader title={formatMonth(referenceMonth)} />
      <PageContent>
        <div aria-hidden="true" />
      </PageContent>
    </>
  );
}
