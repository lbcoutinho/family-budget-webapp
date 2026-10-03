import * as React from 'react';

import { optionText, SearchableSelect, type SelectOption } from './searchable-select';

import type { Select as SelectPrimitive } from 'radix-ui';

// Keep the existing declarative option API while using one editable combobox across the app.
function descendants(children: React.ReactNode): React.ReactElement<{ children?: React.ReactNode }>[] {
  return React.Children.toArray(children).flatMap((child) =>
    React.isValidElement<{ children?: React.ReactNode }>(child) ? [child, ...descendants(child.props.children)] : [],
  );
}

function Select(props: Pick<React.ComponentProps<typeof SelectPrimitive.Root>, 'children' | 'value' | 'disabled' | 'onValueChange'>) {
  const { children, value, disabled } = props;
  const nodes = descendants(children);
  const trigger = nodes.find((node) => node.type === SelectTrigger) as React.ReactElement<React.ComponentProps<typeof SelectTrigger>> | undefined;
  const display = nodes.find((node) => node.type === SelectValue) as React.ReactElement<React.ComponentProps<typeof SelectValue>> | undefined;
  const options: SelectOption[] = nodes
    .filter((node) => node.type === SelectItem)
    .map((node) => {
      const props = node.props as React.ComponentProps<typeof SelectItem>;
      return { value: props.value, label: props.textValue ?? optionText(props.children), disabled: props.disabled, alwaysVisible: props.alwaysVisible };
    });
  const { children: _children, ...triggerProps } = trigger?.props ?? {};
  const adornments = React.Children.toArray(_children).filter((child) => React.isValidElement(child) && child.type !== SelectValue);
  return (
    <SearchableSelect
      {...triggerProps}
      startAdornment={adornments.length > 0 ? adornments : undefined}
      disabled={disabled === true || triggerProps.disabled === true}
      placeholder={display?.props.placeholder}
      options={options}
      value={value ?? ''}
      onValueChange={(next) => {
        props.onValueChange?.(next);
      }}
    />
  );
}

function SelectTrigger(_props: Omit<React.ComponentProps<'input'>, 'size'> & { size?: 'sm' | 'default' }) {
  return null;
}
function SelectValue(_props: { placeholder?: string }) {
  return null;
}
function SelectContent(_props: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return null;
}
function SelectItem(_props: React.ComponentProps<typeof SelectPrimitive.Item> & { alwaysVisible?: boolean }) {
  return null;
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
