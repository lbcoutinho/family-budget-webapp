import { Loader2Icon } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Say what happens, not "tem certeza?" — the question is already in the buttons. */
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `destructive` paints the confirm button red. Deactivation is reversible, so it stays default. */
  variant?: 'default' | 'destructive';
  /** Keeps the dialog open and the buttons busy while the mutation runs. */
  isPending?: boolean;
  onConfirm: () => void;
}

/**
 * Asked before an action that is worth a second of thought — deactivating an account, deleting a
 * category. Not before everything: logging out asks nothing (settled on the shell prototype), and
 * neither does anything else that costs one click to undo.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  isPending = false,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild={typeof description !== 'string'}>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={isPending}>
            {isPending && <Loader2Icon className="animate-spin" />}
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
