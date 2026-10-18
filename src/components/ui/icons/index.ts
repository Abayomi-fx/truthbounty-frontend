/**
 * UI-FE-089 — Icon registry public surface.
 *
 * - Metadata + semantic contract: `./catalogue`
 * - Dynamic component: `./Icon`
 * - Icon-only control: `./IconButton`
 * - Tree-shakeable single-icon imports: `./selective`
 */

export {
  ICON_CATALOGUE,
  ICON_CATEGORIES,
  ICON_NAMES,
  STATUS_ICON_NAMES,
  getIconDefinition,
  getStatusIconName,
  isIconName,
  type IconCategory,
  type IconDefinition,
  type IconName,
} from './catalogue';

export {
  Icon,
  ICON_SIZES,
  type DecorativeIconProps,
  type IconProps,
  type IconSize,
  type IconTone,
  type MeaningfulIconProps,
} from './Icon';

export {
  IconButton,
  type IconButtonProps,
} from './IconButton';
