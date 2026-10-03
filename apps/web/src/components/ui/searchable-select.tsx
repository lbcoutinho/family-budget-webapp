import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { Popover } from 'radix-ui';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  alwaysVisible?: boolean;
}

export function optionText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) =>
      React.isValidElement<{ children?: React.ReactNode }>(child)
        ? optionText(child.props.children)
        : typeof child === 'string' || typeof child === 'number'
          ? String(child)
          : '',
    )
    .join('');
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

export function matchesOption(label: string, query: string): boolean {
  const search = normalize(query.trim());
  const normalized = normalize(label);
  return !search || Array.from(normalized.matchAll(/[\p{L}\p{N}]+/gu)).some((word) => normalized.slice(word.index).startsWith(search));
}

type SearchableSelectProps = Omit<React.ComponentProps<'input'>, 'value' | 'defaultValue' | 'onChange' | 'size'> & {
  options: SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  size?: 'sm' | 'default';
  startAdornment?: React.ReactNode;
};

/** Editable combobox: focus stays on the input, including while the portalled list is open. */
export function SearchableSelect({
  options,
  value,
  onValueChange,
  className,
  ref,
  size = 'default',
  startAdornment,
  onBlur,
  onKeyDown,
  onFocus,
  onClick,
  ...props
}: SearchableSelectProps) {
  const { t } = useTranslation();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState<string | null>(null);
  const [highlighted, setHighlighted] = React.useState<string | null>(null);
  const [interacted, setInteracted] = React.useState(false);
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) => option.alwaysVisible === true || matchesOption(option.label, query ?? ''));
  const enabled = filtered.filter((option) => option.disabled !== true);
  const firstMatch =
    enabled.find((option) => option.alwaysVisible !== true) ?? (query?.trim() ? enabled.find((option) => matchesOption(option.label, query)) : undefined);
  const active = enabled.find((option) => option.value === highlighted) ?? (query !== null ? firstMatch : enabled.find((option) => option.value === value));
  const activeIndex = active ? filtered.indexOf(active) : -1;

  React.useImperativeHandle(ref, () => inputRef.current!, []);
  React.useEffect(() => {
    if (open && activeIndex >= 0) listRef.current?.querySelector(`[id="${listId}-${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, listId]);

  function close() {
    setOpen(false);
    setQuery(null);
    setHighlighted(null);
    setInteracted(false);
  }

  function confirm(option: SelectOption | undefined) {
    if (option) onValueChange(option.value);
    close();
  }

  return (
    <Popover.Root open={open && !props.disabled} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <Popover.Anchor asChild>
        <div className={cn('relative min-w-0', className)}>
          <input
            {...props}
            ref={inputRef}
            role="combobox"
            type="text"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open && !props.disabled}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
            data-slot="select-trigger"
            data-size={size}
            data-placeholder={!selected?.label ? '' : undefined}
            value={query ?? (value === '' ? '' : selected?.label) ?? ''}
            className={cn(
              'w-full min-w-0 rounded-md border border-input bg-transparent px-3 pr-8 text-base shadow-xs outline-none transition-color-shadow shell:text-sm',
              size === 'sm' ? 'h-8' : 'h-9',
              startAdornment && 'pl-9',
              'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
            )}
            onFocus={(event) => {
              event.currentTarget.select();
              onFocus?.(event);
            }}
            onClick={(event) => {
              if (!open) event.currentTarget.select();
              setOpen(true);
              onClick?.(event);
            }}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setHighlighted(null);
              setInteracted(true);
              setOpen(true);
            }}
            onPaste={(event) => {
              if (query === null) event.currentTarget.select();
              props.onPaste?.(event);
            }}
            onCompositionStart={(event) => {
              if (query === null) event.currentTarget.select();
              props.onCompositionStart?.(event);
            }}
            onBlur={(event) => {
              close();
              onBlur?.(event);
            }}
            onKeyDown={(event) => {
              onKeyDown?.(event);
              if (event.defaultPrevented || event.nativeEvent.isComposing) return;
              if (
                query === null &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey &&
                (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete')
              ) {
                event.currentTarget.select();
              }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const direction = event.key === 'ArrowDown' ? 1 : -1;
                const index = active ? enabled.indexOf(active) : direction === 1 ? -1 : 0;
                const next = enabled[(index + direction + enabled.length) % enabled.length];
                setHighlighted(next?.value ?? null);
                setInteracted(true);
                setOpen(true);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                if (open && active) confirm(active);
                else if (!open) setOpen(true);
              } else if (event.key === 'Tab') {
                if (open && interacted) confirm(active);
                else close();
              } else if (event.key === 'Escape' && open) {
                event.preventDefault();
                event.stopPropagation();
                close();
              }
            }}
          />
          {startAdornment ? (
            <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center [&_svg]:size-4">
              {startAdornment}
            </span>
          ) : null}
          <ChevronDownIcon aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 max-h-72 w-(--radix-popover-trigger-width) min-w-32 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (inputRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            close();
          }}
        >
          <div ref={listRef} id={listId} role="listbox" aria-label={props['aria-label']}>
            {filtered.length === 0 || (query !== null && firstMatch === undefined) ? (
              <p role="status" className="px-2 py-2 text-sm text-muted-foreground">
                {t('common.noOptionsFound')}
              </p>
            ) : null}
            {filtered.map((option, index) => (
              <div
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                tabIndex={-1}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && option.disabled !== true) confirm(option);
                }}
                aria-selected={option.value === value}
                aria-disabled={option.disabled === true ? true : undefined}
                data-value={option.value}
                data-highlighted={option === active ? '' : undefined}
                className={cn(
                  'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-2 pr-8 text-sm select-none',
                  option === active && 'bg-accent text-accent-foreground',
                  option.disabled && 'opacity-50',
                )}
                onPointerMove={() => {
                  if (option.disabled !== true) setHighlighted(option.value);
                }}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (option.disabled !== true) confirm(option);
                }}
              >
                {option.label}
                {option.value === value ? <CheckIcon aria-hidden="true" className="absolute right-2 size-4" /> : null}
              </div>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
