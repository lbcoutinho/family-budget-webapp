import { type CashboxDto } from '@family-budget/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon } from 'lucide-react';
import { useEffect, type FocusEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type TranslationKey } from '@/i18n';
import { apiErrorMessage } from '@/lib/api-error';
import { formatCents, parseCurrencyInput } from '@/lib/money';

// Module-level, like `account-dialog.tsx`'s schema: `t` does not exist here, so messages are keys.
const cashboxSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'cashboxes.form.nameRequired' satisfies TranslationKey)
    .max(80, 'cashboxes.form.nameTooLong' satisfies TranslationKey),
  description: z.string().max(500, 'cashboxes.form.descriptionTooLong' satisfies TranslationKey),
  // Blank is a legitimate "no goal" (a cashbox can simply accumulate), not an error — only
  // something that fails to parse at all is.
  targetAmount: z
    .string()
    .refine((value) => value.trim() === '' || parseCurrencyInput(value) !== null, 'cashboxes.form.targetInvalid' satisfies TranslationKey),
});

type CashboxFormValues = z.infer<typeof cashboxSchema>;

export interface CashboxDialogSubmitValues {
  name: string;
  description: string | null;
  targetAmount: number | null;
}

export interface CashboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `undefined` means create; a value means edit, and pre-fills the form. */
  cashbox?: CashboxDto;
  isPending: boolean;
  error: unknown;
  onSubmit: (values: CashboxDialogSubmitValues) => void;
}

/** Create and edit share one dialog and one shape — the two forms are otherwise identical. */
export function CashboxDialog({ open, onOpenChange, cashbox, isPending, error, onSubmit }: CashboxDialogProps) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CashboxFormValues>({
    resolver: zodResolver(cashboxSchema),
    defaultValues: { name: '', description: '', targetAmount: '' },
  });

  // The form only needs to know the cashbox when the dialog opens, not on every parent render —
  // resetting on every render would fight back against whatever the user just typed.
  useEffect(() => {
    if (open) {
      reset({
        name: cashbox?.name ?? '',
        description: cashbox?.description ?? '',
        targetAmount: cashbox?.targetAmount != null ? formatCents(cashbox.targetAmount) : '',
      });
    }
  }, [open, cashbox, reset]);

  const submit = handleSubmit((values) => {
    const trimmedTarget = values.targetAmount.trim();
    const targetAmount = trimmedTarget === '' ? null : parseCurrencyInput(trimmedTarget);

    // The resolver already rejected anything non-empty that parses to null, so this is
    // unreachable in practice — it exists so the type below is `number | null`, not `number | null`.
    if (trimmedTarget !== '' && targetAmount === null) {
      return;
    }

    onSubmit({
      name: values.name.trim(),
      description: values.description.trim() === '' ? null : values.description.trim(),
      targetAmount,
    });
  });

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>{cashbox ? t('cashboxes.form.editTitle') : t('cashboxes.form.createTitle')}</DialogTitle>
        </DialogHeader>

        <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-3.5">
          <div className="grid gap-1.5">
            <Label htmlFor="cashbox-name">{t('cashboxes.form.name')}</Label>
            <Input
              id="cashbox-name"
              placeholder={t('cashboxes.form.namePlaceholder')}
              aria-invalid={errors.name !== undefined}
              aria-describedby={errors.name ? 'cashbox-name-error' : undefined}
              disabled={isPending}
              {...register('name')}
            />
            {errors.name && (
              <span id="cashbox-name-error" className="text-xs text-destructive">
                {t(errors.name.message as TranslationKey)}
              </span>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cashbox-description">{t('cashboxes.form.description')}</Label>
            <Input
              id="cashbox-description"
              placeholder={t('cashboxes.form.descriptionPlaceholder')}
              aria-invalid={errors.description !== undefined}
              aria-describedby={errors.description ? 'cashbox-description-error' : undefined}
              disabled={isPending}
              {...register('description')}
            />
            {errors.description && (
              <span id="cashbox-description-error" className="text-xs text-destructive">
                {t(errors.description.message as TranslationKey)}
              </span>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cashbox-target-amount">{t('cashboxes.form.target')}</Label>
            <Input
              id="cashbox-target-amount"
              inputMode="decimal"
              placeholder={t('cashboxes.form.targetPlaceholder')}
              className="text-right tabular-nums"
              aria-invalid={errors.targetAmount !== undefined}
              aria-describedby={errors.targetAmount ? 'cashbox-target-amount-error' : 'cashbox-target-amount-hint'}
              disabled={isPending}
              {...register('targetAmount', {
                // The whole "mask": re-format from the parsed cents once the user leaves the field,
                // so `5000` becomes `5.000,00` without a masking library watching every keystroke.
                onBlur: (event: FocusEvent<HTMLInputElement>) => {
                  if (event.target.value.trim() === '') {
                    return;
                  }

                  const cents = parseCurrencyInput(event.target.value);

                  if (cents !== null) {
                    setValue('targetAmount', formatCents(cents), { shouldValidate: true });
                  }
                },
              })}
            />
            {errors.targetAmount ? (
              <span id="cashbox-target-amount-error" className="text-xs text-destructive">
                {t(errors.targetAmount.message as TranslationKey)}
              </span>
            ) : (
              <span id="cashbox-target-amount-hint" className="text-xs text-muted-foreground">
                {t('cashboxes.form.targetHint')}
              </span>
            )}
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
