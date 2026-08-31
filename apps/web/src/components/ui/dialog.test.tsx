import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './dialog';

describe('DialogContent', () => {
  it('uses localized close text and keeps long content inside the viewport', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teste</DialogTitle>
          </DialogHeader>
          <p>Conteúdo</p>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>,
    );

    const closeButtons = screen.getAllByRole('button', { name: 'Fechar' });
    expect(closeButtons).toHaveLength(2);
    expect(screen.getByRole('dialog')).toHaveClass('max-h-dvh', 'overflow-y-auto');
    expect(screen.getByText('Teste').parentElement).toHaveClass('sticky', 'top-0');
    expect(closeButtons[0]!.parentElement).toHaveClass('sticky', 'bottom-0');
  });
});
