import { useTranslation } from 'react-i18next';

import { CATEGORY_PALETTE } from './category-colors';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

export interface ColorPickerProps {
  /** Free text as the user types it — validated on submit, not here, same as the rest of the form. */
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}

/**
 * The only screen where the palette appears as a palette (`04-categories.html`). Ten swatches and a
 * hex input beside them, not behind a disclosure — eleven or twelve categories is the real ceiling,
 * so whoever lands on a repeated colour needs the escape hatch to be visible, not hidden.
 */
export function ColorPicker({ value, onChange, invalid }: ColorPickerProps) {
  const { t } = useTranslation();
  const normalized = value.trim().toLowerCase();
  const isValidHex = HEX_PATTERN.test(value.trim());

  return (
    <div className="grid gap-1.5">
      <Label>{t('categories.field.color')}</Label>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_PALETTE.map((hex, index) => {
          const isGrey = index === CATEGORY_PALETTE.length - 1;

          return (
            <Button
              key={hex}
              variant="ghost"
              size="icon-sm"
              aria-pressed={normalized === hex}
              aria-label={t(isGrey ? 'categories.color.swatchGrey' : 'categories.color.swatch', { number: index + 1 })}
              className={cn('size-7 rounded-md border-2 p-0', normalized === hex ? 'border-foreground' : 'border-transparent')}
              style={{ background: hex }}
              onClick={() => onChange(hex)}
            />
          );
        })}
      </div>
      <div className="flex items-end gap-2.5">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="category-color-hex" className="text-xs text-muted-foreground">
            {t('categories.field.colorHex')}
          </Label>
          <Input
            id="category-color-hex"
            aria-invalid={invalid}
            aria-describedby={invalid ? 'category-color-hex-error' : undefined}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
        <span className="size-8 flex-none rounded-md border border-border" style={{ background: isValidHex ? value : undefined }} />
      </div>
      {invalid && (
        <span id="category-color-hex-error" className="text-xs text-destructive">
          {t('categories.color.invalid')}
        </span>
      )}
    </div>
  );
}
