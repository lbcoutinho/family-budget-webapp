import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'auth-brand',
        'badge',
        'field',
        'headline',
        'month-total',
        'report-caption',
        'sidebar-avatar',
        'sidebar-meta',
        'sidebar-nav',
        'table-cell',
        'table-header',
        'table-meta',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
