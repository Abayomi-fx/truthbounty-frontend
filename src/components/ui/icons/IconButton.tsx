'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

import type { IconName } from './catalogue';
import { Icon, type IconSize, type IconTone } from './Icon';

/**
 * UI-FE-089 — Accessible icon-only control.
 *
 * Wraps a native `<button>` and requires an accessible `label`. The glyph is
 * rendered decoratively (`aria-hidden`) and the button itself carries the
 * accessible name, so icon-only controls are always announced correctly.
 */

const iconButtonVariants = cva(
  'inline-flex items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        ghost: 'bg-transparent text-ink-secondary hover:bg-surface hover:text-ink',
        solid: 'bg-action text-action-ink hover:bg-action-hover',
        outline: 'border border-divider bg-surface text-ink hover:bg-elevated',
      },
      size: {
        sm: 'size-8',
        md: 'size-9',
        lg: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
    },
  },
);

const BUTTON_SIZE_TO_ICON_SIZE: Record<'sm' | 'md' | 'lg', IconSize> = {
  sm: 'sm',
  md: 'sm',
  lg: 'md',
};

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'>,
    VariantProps<typeof iconButtonVariants> {
  /** Approved icon to render. */
  name: IconName;
  /** Required accessible name for the control. */
  label: string;
  /** Semantic colour token for the glyph. */
  tone?: IconTone;
  /** Override the glyph size. */
  iconSize?: IconSize;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { name, label, tone, iconSize, variant, size = 'md', className, title, ...rest },
    ref,
  ) {
    const resolvedSize = (size ?? 'md') as 'sm' | 'md' | 'lg';

    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={title ?? label}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...rest}
      >
        <Icon
          name={name}
          size={iconSize ?? BUTTON_SIZE_TO_ICON_SIZE[resolvedSize]}
          tone={tone}
        />
      </button>
    );
  },
);

export default IconButton;
