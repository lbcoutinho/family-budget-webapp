import { type AccountDto, type AccountKind, useListFinancialInstitutions, useListInstruments } from '@family-budget/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon } from 'lucide-react';
import { useEffect, useState, type FocusEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type TranslationKey } from '@/i18n';
import { apiErrorMessage } from '@/lib/api-error';
import { formatCents, parseCurrencyInput } from '@/lib/money';

// Module-level, like `login-page.tsx`'s schema: `t` does not exist here, so messages are keys.
const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'accounts.form.nameRequired' satisfies TranslationKey)
    .max(80, 'accounts.form.nameTooLong' satisfies TranslationKey),
  // Blank is a legitimate zero (an account can open with nothing in it), not an error — only
  // something that fails to parse at all is.
  initialBalance: z
    .string()
    .refine((value) => value.trim() === '' || parseCurrencyInput(value) !== null, 'accounts.form.initialBalanceInvalid' satisfies TranslationKey),
  kind: z.enum(['BANK', 'BROKERAGE', 'EXCHANGE', 'WALLET', 'OTHER']),
  financialInstitutionId: z.string(),
});

type AccountFormValues = z.infer<typeof accountSchema>;

export interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `undefined` means create; a value means edit, and pre-fills the form. */
  account?: AccountDto;
  isPending: boolean;
  error: unknown;
  onSubmit: (values: {
    name: string;
    initialBalance: number;
    kind: AccountKind;
    financialInstitutionId: string | null;
    initialBalances: { instrumentId: string; quantity: string }[];
  }) => void;
}

/** Create and edit share one dialog and one shape — the two forms are otherwise identical. */
export function AccountDialog({ open, onOpenChange, account, isPending, error, onSubmit }: AccountDialogProps) {
  const { t } = useTranslation();
  const institutions = useListFinancialInstitutions();
  const instruments = useListInstruments();
  const [initialBalances, setInitialBalances] = useState(() =>
    (account?.initialBalances ?? []).map(({ instrumentId, quantity }) => ({ instrumentId, quantity })),
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: '', initialBalance: formatCents(0), kind: 'BANK', financialInstitutionId: 'none' },
  });
  const kind = useWatch({ control, name: 'kind' });
  const financialInstitutionId = useWatch({ control, name: 'financialInstitutionId' });

  // The form only needs to know the account when the dialog opens, not on every parent render —
  // resetting on every render would fight back against whatever the user just typed.
  useEffect(() => {
    if (open) {
      reset({
        name: account?.name ?? '',
        initialBalance: formatCents(account?.initialBalance ?? 0),
        kind: account?.kind ?? 'BANK',
        financialInstitutionId: account?.financialInstitutionId ?? 'none',
      });
    }
  }, [open, account, reset]);

  const submit = handleSubmit((values) => {
    const cents = values.initialBalance.trim() === '' ? 0 : parseCurrencyInput(values.initialBalance);

    // The resolver already rejected anything else that parses to null, so this is unreachable in
    // practice — it exists so the type below is `number`, not `number | null`.
    if (cents === null) {
      return;
    }

    onSubmit({
      name: values.name.trim(),
      initialBalance: cents,
      kind: values.kind,
      financialInstitutionId: values.financialInstitutionId === 'none' ? null : values.financialInstitutionId,
      initialBalances: initialBalances.filter((balance) => balance.instrumentId && balance.quantity.trim()),
    });
  });

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>{account ? t('accounts.form.editTitle') : t('accounts.form.createTitle')}</DialogTitle>
        </DialogHeader>

        <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-3.5">
          <div className="grid gap-1.5">
            <Label htmlFor="account-name">{t('accounts.form.name')}</Label>
            <Input
              id="account-name"
              placeholder={t('accounts.form.namePlaceholder')}
              aria-invalid={errors.name !== undefined}
              aria-describedby={errors.name ? 'account-name-error' : undefined}
              disabled={isPending}
              {...register('name')}
            />
            {errors.name && (
              <span id="account-name-error" className="text-xs text-destructive">
                {t(errors.name.message as TranslationKey)}
              </span>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>{t('accounts.form.instrumentBalances')}</Label>
            {initialBalances.map((balance, index) => (
              <div className="flex gap-2" key={`${balance.instrumentId}-${index}`}>
                <Select
                  value={balance.instrumentId}
                  onValueChange={(instrumentId) =>
                    setInitialBalances((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, instrumentId } : row)))
                  }
                >
                  <SelectTrigger aria-label={t('accounts.form.instrument')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(instruments.data ?? []).map((instrument) => (
                      <SelectItem key={instrument.id} value={instrument.id}>
                        {instrument.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  aria-label={t('accounts.form.quantity')}
                  value={balance.quantity}
                  inputMode="decimal"
                  onChange={(event) =>
                    setInitialBalances((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, quantity: event.target.value } : row)))
                  }
                />
                <Button type="button" variant="ghost" onClick={() => setInitialBalances((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>
                  {t('common.delete')}
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={!instruments.data?.length}
              onClick={() => setInitialBalances((rows) => [...rows, { instrumentId: instruments.data?.[0]?.id ?? '', quantity: '' }])}
            >
              {t('accounts.form.addInstrument')}
            </Button>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="account-kind">{t('accounts.form.kind')}</Label>
            <Select value={kind} onValueChange={(kind) => setValue('kind', kind as AccountKind)}>
              <SelectTrigger id="account-kind" disabled={isPending}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['BANK', 'BROKERAGE', 'EXCHANGE', 'WALLET', 'OTHER'] as const).map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {t(`accounts.kinds.${kind}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="account-institution">{t('accounts.form.institution')}</Label>
            <Select value={financialInstitutionId} onValueChange={(financialInstitutionId) => setValue('financialInstitutionId', financialInstitutionId)}>
              <SelectTrigger id="account-institution" disabled={isPending || institutions.isPending}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('accounts.form.selfCustody')}</SelectItem>
                {(institutions.data ?? []).map((institution) => (
                  <SelectItem key={institution.id} value={institution.id}>
                    {institution.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="account-initial-balance">{t('accounts.form.initialBalance')}</Label>
            <Input
              id="account-initial-balance"
              inputMode="decimal"
              className="text-right tabular-nums"
              aria-invalid={errors.initialBalance !== undefined}
              aria-describedby={errors.initialBalance ? 'account-initial-balance-error' : undefined}
              disabled={isPending}
              {...register('initialBalance', {
                // The whole "mask": re-format from the parsed cents once the user leaves the field,
                // so `1234.56` becomes `1.234,56` without a masking library watching every keystroke.
                onBlur: (event: FocusEvent<HTMLInputElement>) => {
                  const cents = parseCurrencyInput(event.target.value);

                  if (cents !== null) {
                    setValue('initialBalance', formatCents(cents), { shouldValidate: true });
                  }
                },
              })}
            />
            {errors.initialBalance ? (
              <span id="account-initial-balance-error" className="text-xs text-destructive">
                {t(errors.initialBalance.message as TranslationKey)}
              </span>
            ) : null}
          </div>

          {error !== undefined && error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {apiErrorMessage(error, t)}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2Icon className="animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
