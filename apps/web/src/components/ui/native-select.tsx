import * as React from 'react';

import { optionText, SearchableSelect, type SelectOption } from './searchable-select';

type NativeSelectProps = Omit<React.ComponentProps<typeof SearchableSelect>, 'options'> & { children: React.ReactNode };

/** Retains native option markup at call sites; interaction is shared with every other selector. */
function NativeSelect({ children, placeholder, ...props }: NativeSelectProps) {
  const options = React.Children.toArray(children)
    .filter((child): child is React.ReactElement<React.ComponentProps<'option'>> => React.isValidElement(child))
    .map((child): SelectOption => ({
      value: String(child.props.value ?? optionText(child.props.children)),
      label: optionText(child.props.children),
      disabled: child.props.disabled,
    }));
  return <SearchableSelect {...props} placeholder={placeholder ?? options.find((option) => option.value === '')?.label} options={options} />;
}

export { NativeSelect };
