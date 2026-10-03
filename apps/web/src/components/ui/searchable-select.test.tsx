import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { matchesOption, SearchableSelect, type SelectOption } from './searchable-select';

const options: SelectOption[] = [
  { value: 'millennium', label: 'Banco Millennium' },
  { value: 'credit', label: 'Crédito pessoal' },
  { value: 'revolut', label: 'Revolut' },
  { value: 'inactive', label: 'Revolut inactive', disabled: true },
];

function Example({ initial = '', optional = false, onSubmit = vi.fn() }: { initial?: string; optional?: boolean; onSubmit?: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="account">Account</label>
      <SearchableSelect
        id="account"
        value={value}
        onValueChange={setValue}
        options={optional ? [...options, { value: '', label: 'No account', alwaysVisible: true }] : options}
      />
      <label htmlFor="date">Next field</label>
      <input id="date" />
      <button type="submit">Save</button>
      <output aria-label="Selected value">{value}</output>
    </form>
  );
}

describe('SearchableSelect', () => {
  it('matches word prefixes, accents, case, and phrases, without matching the middle of a word', () => {
    expect(matchesOption('Banco Millennium', 'mi')).toBe(true);
    expect(matchesOption('Crédito pessoal', 'CRED')).toBe(true);
    expect(matchesOption('Banco Millennium', 'banco mi')).toBe(true);
    expect(matchesOption('Banco Millennium', 'len')).toBe(false);
  });

  it('filters on typing, highlights the first match, and confirms with Enter without submitting', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(<Example onSubmit={submit} />);
    const account = screen.getByRole('combobox', { name: 'Account' });
    await user.tab();
    expect(account).toHaveFocus();
    await user.keyboard('Mi');
    expect(screen.getByRole('option', { name: 'Banco Millennium' })).toHaveAttribute('data-highlighted');
    expect(screen.queryByRole('option', { name: 'Revolut' })).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(account).toHaveValue('Banco Millennium');
    expect(account).toHaveFocus();
    expect(screen.getByLabelText('Selected value')).toHaveTextContent('millennium');
    expect(submit).not.toHaveBeenCalled();
  });

  it('preserves a label on focus and replaces it only when typing starts; Escape restores selection', async () => {
    const user = userEvent.setup();
    render(<Example initial="millennium" />);
    const account = screen.getByRole('combobox', { name: 'Account' });
    await user.tab();
    expect(account).toHaveValue('Banco Millennium');
    await user.keyboard('cred');
    expect(account).toHaveValue('cred');
    expect(screen.getByRole('option', { name: 'Crédito pessoal' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(account).toHaveValue('Banco Millennium');
    expect(screen.getByLabelText('Selected value')).toHaveTextContent('millennium');
  });

  it('commits a searched option on Tab and supports reverse focus navigation', async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.tab();
    await user.keyboard('mi');
    await user.tab();
    expect(screen.getByRole('combobox')).toHaveValue('Banco Millennium');
    expect(screen.getByLabelText('Next field')).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('combobox')).toHaveFocus();
    await user.keyboard('re');
    await user.tab({ shift: true });
    expect(screen.getByRole('combobox')).toHaveValue('Revolut');
  });

  it('does not choose a value merely by focusing or opening an empty selector', async () => {
    const user = userEvent.setup();
    render(<Example />);
    const account = screen.getByRole('combobox');
    await user.click(account);
    await user.tab();
    expect(account).toHaveValue('');
    expect(screen.getByLabelText('Next field')).toHaveFocus();
  });

  it('uses Up/Down to navigate and Tab to confirm, skipping disabled options', async () => {
    const user = userEvent.setup();
    render(<Example initial="millennium" />);
    await user.tab();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Banco Millennium' })).toHaveAttribute('data-highlighted');
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('option', { name: 'Revolut' })).toHaveAttribute('data-highlighted');
    await user.tab();
    expect(screen.getByRole('combobox')).toHaveValue('Revolut');
  });

  it('keeps the previous value on no matches and does not submit or clear it on Enter', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(<Example initial="millennium" onSubmit={submit} />);
    await user.tab();
    await user.keyboard('missing{Enter}');
    expect(screen.getByText('Nenhuma opção encontrada')).toHaveTextContent('Nenhuma opção encontrada');
    expect(screen.getByRole('combobox')).toHaveValue('missing');
    expect(submit).not.toHaveBeenCalled();
    await user.tab();
    expect(screen.getByRole('combobox')).toHaveValue('Banco Millennium');
    expect(screen.getByLabelText('Next field')).toHaveFocus();
  });

  it('keeps optional clearing available without automatically clearing on an unmatched search', async () => {
    const user = userEvent.setup();
    render(<Example initial="millennium" optional />);
    await user.tab();
    await user.keyboard('missing{Enter}');
    expect(screen.getByRole('option', { name: 'No account' })).toBeInTheDocument();
    await user.tab();
    expect(screen.getByLabelText('Selected value')).toHaveTextContent('millennium');
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('mi');
    await user.click(screen.getByRole('option', { name: 'No account' }));
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.getByLabelText('Selected value')).toBeEmptyDOMElement();
  });

  it('can select an explicit clear option by searching its label', async () => {
    const user = userEvent.setup();
    render(<Example initial="millennium" optional />);
    await user.tab();
    await user.keyboard('no account{Enter}');
    expect(screen.getByLabelText('Selected value')).toBeEmptyDOMElement();
  });

  it('starts a fresh search even when the caret was moved inside the committed label', async () => {
    const user = userEvent.setup();
    render(<Example initial="millennium" />);
    const account = screen.getByRole<HTMLInputElement>('combobox');
    await user.click(account);
    account.setSelectionRange(account.value.length, account.value.length);
    await user.keyboard('cred');
    expect(account).toHaveValue('cred');
    expect(screen.getByRole('option', { name: 'Crédito pessoal' })).toBeInTheDocument();
  });

  it('handles pasted queries and pointer selection', async () => {
    const user = userEvent.setup();
    render(<Example initial="millennium" />);
    const account = screen.getByRole('combobox');
    await user.click(account);
    await user.paste('credito');
    expect(account).toHaveValue('credito');
    await user.click(screen.getByRole('option', { name: 'Crédito pessoal' }));
    expect(account).toHaveValue('Crédito pessoal');
    expect(account).toHaveFocus();
  });

  it('allows IME composition to finish without confirming', () => {
    render(<Example />);
    const account = screen.getByRole('combobox');
    fireEvent.change(account, { target: { value: 'mi' } });
    fireEvent.keyDown(account, { key: 'Enter', isComposing: true });
    expect(screen.getByLabelText('Selected value')).toBeEmptyDOMElement();
  });
});
