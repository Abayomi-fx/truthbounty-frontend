'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import type { StatusToneName } from '@/lib/design-tokens';

import type { IconName } from './catalogue';
import { getIconComponent } from './icon-map';

/**
 * UI-FE-089 — Accessible Icon primitive.
 *
 * A single, typed entry point for every approved icon. Size, stroke, colour
 * (tone), decorative, and interactive variants are all expressed through this
 * component so the visual language stays consistent.
 *
 * Accessibility contract (enforced by the type system and at runtime):
 * - `decorative` icons (the default) are hidden from the accessibility tree
 *   with `aria-hidden="true"` and `focusable="false"`; a visible label in the
 *   surrounding control must carry the meaning.
 * - meaningful icons (`decorative={false}`) are exposed as `role="img"` and
 *   MUST supply an accessible name (`title` or `aria-label`). Omitting it is a
 *   compile-time error and a runtime error.
 * - Icons never rely on colour alone to convey status; status glyphs are
 *   reserved by `STATUS_ICON_NAMES`.
 */

export const ICON_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
export type IconSize = (typeof ICON_SIZES)[number];

export type IconTone = StatusToneName | 'inherit';

/** Tailwind box sizes for each approved size. */
const SIZE_CLASSES: Record<IconSize, string> = {
  xs: 'size-3.5',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
  xl: 'size-8',
};

/** Stroke widths keep optical weight consistent across sizes. */
const SIZE_STROKE: Record<IconSize, number> = {
  xs: 2.25,
  sm: 2,
  md: 2,
  lg: 1.75,
  xl: 1.5,
};

/** Colour is always drawn from a semantic token, never a raw palette value. */
const TONE_CLASSES: Record<IconTone, string> = {
  inherit: '',
  neutral: 'text-ink-secondary',
  pending: 'text-pending',
  confirmed: 'text-confirmed',
  finalized: 'text-finalized',
  orphaned: 'text-orphaned',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

interface BaseIconProps {
  /** Approved semantic icon name from the registry. */
  name: IconName;
  /** Visual size token. Defaults to `md`. */
  size?: IconSize;
  /** Semantic colour token. Defaults to `inherit` (currentColor). */
  tone?: IconTone;
  /** Renders the icon in a muted, non-interactive state. */
  disabled?: boolean;
  /** Extra layout classes. */
  className?: string;
  /** Override the size-derived stroke width. */
  strokeWidth?: number;
}

/** A purely decorative icon (hidden from assistive technology). */
export type DecorativeIconProps = BaseIconProps & { decorative?: true };

/** A meaningful icon that must carry an accessible name. */
export type MeaningfulIconProps = BaseIconProps &
  { decorative: false } &
  (
    | { title: string; 'aria-label'?: string }
    | { 'aria-label': string; title?: string }
  );

export type IconProps = DecorativeIconProps | MeaningfulIconProps;

const ACCESSIBLE_NAME_ERROR =
  'decoration must be disabled AND an accessible name (title or aria-label) provided.';

export function Icon(props: IconProps) {
  const {
    name,
    size = 'md',
    tone = 'inherit',
    disabled = false,
    className,
    strokeWidth,
  } = props;
  const decorative = props.decorative ?? true;

  const Glyph = getIconComponent(name);

  type IconDomProps = React.SVGProps<SVGSVGElement> & {
    [dataAttribute: `data-${string}`]: string | undefined;
  };

  const shared: IconDomProps = {
    'data-icon': name,
    'data-size': size,
    'data-decorative': decorative ? 'true' : 'false',
    ...(disabled ? { 'data-disabled': 'true' } : {}),
    focusable: 'false',
    strokeWidth: strokeWidth ?? SIZE_STROKE[size],
    className: cn(
      SIZE_CLASSES[size],
      TONE_CLASSES[tone],
      name === 'loader' ? 'motion-safe:animate-spin' : null,
      disabled ? 'opacity-50' : null,
      className,
    ),
  };

  if (decorative) {
    return <Glyph aria-hidden="true" {...shared} />;
  }

  const meaningful = props as MeaningfulIconProps;
  const accessibleName = meaningful['aria-label'] ?? meaningful.title;

  if (typeof accessibleName !== 'string' || accessibleName.trim() === '') {
    throw new Error(`[Icon] "${name}" is not decorative; ${ACCESSIBLE_NAME_ERROR}`);
  }

  return (
    <Glyph
      role="img"
      aria-label={accessibleName}
      {...shared}
    />
  );
}

export default Icon;