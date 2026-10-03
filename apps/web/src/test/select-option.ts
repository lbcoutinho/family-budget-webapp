import { screen, waitFor } from '@testing-library/react';

import type userEvent from '@testing-library/user-event';

/** Choose an option through the visible list, using its stable value or displayed label. */
export async function selectOption(user: ReturnType<typeof userEvent.setup>, control: HTMLElement, value: string) {
  if (control instanceof HTMLSelectElement) {
    await user.selectOptions(control, value);
    return;
  }
  await user.click(control);
  const option = await waitFor(() => {
    const candidate = screen.getAllByRole('option').find((item) => item.getAttribute('data-value') === value || item.textContent === value);
    if (!candidate) throw new Error(`Option not found: ${value}`);
    return candidate;
  });
  await user.click(option);
}
