import { useListAssetListings, useListFinancialInstitutions, useListInstruments } from '@family-budget/api-client';
import { TriangleAlertIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/empty-state';
import { PageContent, PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function SetupError() {
  const { t } = useTranslation();
  return <EmptyState icon={TriangleAlertIcon} title={t('investmentSetup.error.title')} description={t('investmentSetup.error.description')} />;
}

export function FinancialInstitutionsPage() {
  const institutions = useListFinancialInstitutions();
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('investmentSetup.institutions.title')} />
      <PageContent>
        <p className="mb-4 text-sm text-muted-foreground">{t('investmentSetup.institutions.description')}</p>
        <Card className="py-0">
          {institutions.isError ? (
            <SetupError />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('investmentSetup.columns.institution')}</TableHead>
                  <TableHead>{t('investmentSetup.columns.type')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(institutions.data ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.kind}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </PageContent>
    </>
  );
}

export function InstrumentsPage() {
  const instruments = useListInstruments();
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('investmentSetup.instruments.title')} />
      <PageContent>
        <p className="mb-4 text-sm text-muted-foreground">{t('investmentSetup.instruments.description')}</p>
        <Card className="py-0">
          {instruments.isError ? (
            <SetupError />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('investmentSetup.columns.instrument')}</TableHead>
                  <TableHead>{t('investmentSetup.columns.code')}</TableHead>
                  <TableHead>{t('investmentSetup.columns.type')}</TableHead>
                  <TableHead>{t('investmentSetup.columns.precision')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(instruments.data ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell>{item.displayPrecision}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </PageContent>
    </>
  );
}

export function AssetListingsPage() {
  const listings = useListAssetListings();
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('investmentSetup.listings.title')} />
      <PageContent>
        <p className="mb-4 text-sm text-muted-foreground">{t('investmentSetup.listings.description')}</p>
        <Card className="py-0">
          {listings.isError ? (
            <SetupError />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('investmentSetup.columns.asset')}</TableHead>
                  <TableHead>{t('investmentSetup.columns.ticker')}</TableHead>
                  <TableHead>{t('investmentSetup.columns.market')}</TableHead>
                  <TableHead>{t('investmentSetup.columns.quote')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(listings.data ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.instrumentName}</TableCell>
                    <TableCell>{item.ticker}</TableCell>
                    <TableCell>{item.market}</TableCell>
                    <TableCell>{item.quoteInstrumentCode}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </PageContent>
    </>
  );
}
