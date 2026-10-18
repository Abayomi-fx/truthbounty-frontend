/**
 * UI-FE-089 — Approved Icon Catalogue (metadata only)
 *
 * The single typed source of truth for the semantic names, categories, and
 * documented meanings of every approved production icon. This module
 * intentionally contains **no icon component imports** so that importing the
 * catalogue never pulls the icon implementation into a bundle. The concrete
 * glyphs live in `icon-map.ts` (dynamic path) and `selective.ts` (tree-shakeable
 * named-export path).
 *
 * Contract:
 * - Every production icon MUST be registered here with a semantic name.
 * - Names describe meaning, not shape (`shield-check`, not `green-tick`).
 * - Status semantics are reserved: a status meaning maps to exactly one glyph
 *   via `STATUS_ICON_NAMES`, and colour/shape is never the sole indicator.
 */

import type { StatusToneName } from '@/lib/design-tokens';

export const ICON_CATEGORIES = [
  'navigation',
  'action',
  'status',
  'data',
  'security',
  'system',
  'social',
] as const;

export type IconCategory = (typeof ICON_CATEGORIES)[number];

/**
 * The approved icon name vocabulary. Adding an icon requires adding it here,
 * to `ICON_CATALOGUE`, and to `icon-map.ts`; the registry contract test
 * enforces that the three stay in sync.
 */
export const ICON_NAMES = [
  'alert',
  'alert-triangle',
  'arrow-left',
  'arrow-right',
  'arrow-up-right',
  'ban',
  'calendar',
  'check',
  'check-check',
  'check-circle',
  'clock',
  'copy',
  'database',
  'download',
  'external-link',
  'file-check',
  'file-text',
  'gauge',
  'help',
  'history',
  'info',
  'key',
  'layers',
  'link',
  'list-checks',
  'loader',
  'lock',
  'log-in',
  'log-out',
  'monitor',
  'moon',
  'plus',
  'refresh',
  'rotate-ccw',
  'scale',
  'settings',
  'shield',
  'shield-alert',
  'shield-check',
  'sparkles',
  'sun',
  'tag',
  'thumbs-down',
  'thumbs-up',
  'undo',
  'users',
  'wallet',
  'wifi',
  'wifi-off',
  'x',
  'x-circle',
  'zap',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export interface IconDefinition {
  /** Stable semantic name used by components. */
  readonly name: IconName;
  /** Short human-readable label for documentation/Storybook. */
  readonly label: string;
  /** Documented meaning; this is what the name must communicate. */
  readonly category: IconCategory;
  /** The approved meaning of the glyph, used in the catalogue docs. */
  readonly semantics: string;
  /**
   * When present, this icon is the reserved glyph for that status tone.
   * Status meanings are matched to exactly one glyph across the application.
   */
  readonly statusTone?: StatusToneName;
}

export const ICON_CATALOGUE: Readonly<Record<IconName, IconDefinition>> = {
  alert: {
    name: 'alert',
    label: 'Alert',
    category: 'status',
    semantics: 'A recoverable problem that needs attention but is not destructive.',
  },
  'alert-triangle': {
    name: 'alert-triangle',
    label: 'Warning',
    category: 'status',
    semantics: 'A warning or destructive condition (also the danger tone glyph).',
    statusTone: 'warning',
  },
  'arrow-left': {
    name: 'arrow-left',
    label: 'Back',
    category: 'navigation',
    semantics: 'Navigate to the previous step or view.',
  },
  'arrow-right': {
    name: 'arrow-right',
    label: 'Next',
    category: 'navigation',
    semantics: 'Navigate to the next step or view.',
  },
  'arrow-up-right': {
    name: 'arrow-up-right',
    label: 'Open',
    category: 'navigation',
    semantics: 'Open an external destination.',
  },
  ban: {
    name: 'ban',
    label: 'Blocked',
    category: 'status',
    semantics: 'An action or resource is blocked and cannot proceed.',
  },
  calendar: {
    name: 'calendar',
    label: 'Schedule',
    category: 'data',
    semantics: 'A calendar date, schedule, or timed event.',
  },
  check: {
    name: 'check',
    label: 'Done',
    category: 'action',
    semantics: 'A completed or selected item.',
  },
  'check-check': {
    name: 'check-check',
    label: 'Fully confirmed',
    category: 'status',
    semantics: 'A doubly-confirmed or fully-settled result.',
  },
  'check-circle': {
    name: 'check-circle',
    label: 'Success',
    category: 'status',
    semantics: 'The success/confirmed status glyph.',
    statusTone: 'success',
  },
  clock: {
    name: 'clock',
    label: 'Pending',
    category: 'status',
    semantics: 'A pending or time-bound status; the reserved pending glyph.',
    statusTone: 'pending',
  },
  copy: {
    name: 'copy',
    label: 'Copy',
    category: 'action',
    semantics: 'Copy the adjacent value to the clipboard.',
  },
  database: {
    name: 'database',
    label: 'Indexed data',
    category: 'data',
    semantics: 'Backend/indexer projection data.',
  },
  download: {
    name: 'download',
    label: 'Download',
    category: 'action',
    semantics: 'Download a file or receipt.',
  },
  'external-link': {
    name: 'external-link',
    label: 'External link',
    category: 'navigation',
    semantics: 'A link that leaves the current application.',
  },
  'file-check': {
    name: 'file-check',
    label: 'Verified file',
    category: 'data',
    semantics: 'A verified document or verified evidence file.',
  },
  'file-text': {
    name: 'file-text',
    label: 'Document',
    category: 'data',
    semantics: 'A document, claim, or text evidence record.',
  },
  gauge: {
    name: 'gauge',
    label: 'Performance',
    category: 'data',
    semantics: 'A performance, load, or health metric.',
  },
  help: {
    name: 'help',
    label: 'Help',
    category: 'system',
    semantics: 'Help or explanatory affordance.',
  },
  history: {
    name: 'history',
    label: 'History',
    category: 'data',
    semantics: 'A past event, audit entry, or historical record.',
  },
  info: {
    name: 'info',
    label: 'Information',
    category: 'status',
    semantics: 'Neutral information; the reserved neutral/info glyph.',
    statusTone: 'info',
  },
  key: {
    name: 'key',
    label: 'Access key',
    category: 'security',
    semantics: 'A key, credential, or permission grant.',
  },
  layers: {
    name: 'layers',
    label: 'Layers',
    category: 'data',
    semantics: 'Stacked layers, batching, or grouped data.',
  },
  link: {
    name: 'link',
    label: 'Link',
    category: 'navigation',
    semantics: 'A reference or association to another resource.',
  },
  'list-checks': {
    name: 'list-checks',
    label: 'Checklist',
    category: 'action',
    semantics: 'A checklist of required or completed steps.',
  },
  loader: {
    name: 'loader',
    label: 'Loading',
    category: 'status',
    semantics: 'An in-progress/loading indicator; respects reduced motion.',
  },
  lock: {
    name: 'lock',
    label: 'Locked',
    category: 'security',
    semantics: 'A locked, restricted, or secured resource.',
  },
  'log-in': {
    name: 'log-in',
    label: 'Sign in',
    category: 'action',
    semantics: 'Sign in or connect an identity.',
  },
  'log-out': {
    name: 'log-out',
    label: 'Sign out',
    category: 'action',
    semantics: 'Sign out or disconnect an identity.',
  },
  monitor: {
    name: 'monitor',
    label: 'System theme',
    category: 'system',
    semantics: 'The system/device theme or a display context.',
  },
  moon: {
    name: 'moon',
    label: 'Dark theme',
    category: 'system',
    semantics: 'The dark colour theme.',
  },
  plus: {
    name: 'plus',
    label: 'Add',
    category: 'action',
    semantics: 'Create or add a new item.',
  },
  refresh: {
    name: 'refresh',
    label: 'Refresh',
    category: 'action',
    semantics: 'Reload or refresh data.',
  },
  'rotate-ccw': {
    name: 'rotate-ccw',
    label: 'Reset',
    category: 'action',
    semantics: 'Reset or undo to a previous state.',
  },
  scale: {
    name: 'scale',
    label: 'Arbitration',
    category: 'status',
    semantics: 'Dispute resolution, arbitration, or balanced judgement.',
  },
  settings: {
    name: 'settings',
    label: 'Settings',
    category: 'system',
    semantics: 'Configuration or settings controls.',
  },
  shield: {
    name: 'shield',
    label: 'Finalized',
    category: 'status',
    semantics: 'Durable finality; the reserved finalized glyph.',
    statusTone: 'finalized',
  },
  'shield-alert': {
    name: 'shield-alert',
    label: 'Security warning',
    category: 'security',
    semantics: 'A security risk or safety-critical warning.',
  },
  'shield-check': {
    name: 'shield-check',
    label: 'Secure',
    category: 'security',
    semantics: 'A verified, secure, or protected state.',
  },
  sparkles: {
    name: 'sparkles',
    label: 'Enhanced',
    category: 'system',
    semantics: 'An enhanced, assisted, or suggested capability.',
  },
  sun: {
    name: 'sun',
    label: 'Light theme',
    category: 'system',
    semantics: 'The light colour theme.',
  },
  tag: {
    name: 'tag',
    label: 'Category',
    category: 'data',
    semantics: 'A category, label, or tag.',
  },
  'thumbs-down': {
    name: 'thumbs-down',
    label: 'Dispute',
    category: 'action',
    semantics: 'A negative or disputing action.',
  },
  'thumbs-up': {
    name: 'thumbs-up',
    label: 'Endorse',
    category: 'action',
    semantics: 'A positive or endorsing action.',
  },
  undo: {
    name: 'undo',
    label: 'Undo',
    category: 'action',
    semantics: 'Undo or revert a change.',
  },
  users: {
    name: 'users',
    label: 'Members',
    category: 'data',
    semantics: 'A group of members or participants.',
  },
  wallet: {
    name: 'wallet',
    label: 'Wallet',
    category: 'security',
    semantics: 'A connected wallet or account.',
  },
  wifi: {
    name: 'wifi',
    label: 'Online',
    category: 'status',
    semantics: 'A connected/online network state.',
  },
  'wifi-off': {
    name: 'wifi-off',
    label: 'Offline',
    category: 'status',
    semantics: 'A disconnected/offline network state.',
  },
  x: {
    name: 'x',
    label: 'Close',
    category: 'action',
    semantics: 'Dismiss or close a surface.',
  },
  'x-circle': {
    name: 'x-circle',
    label: 'Rejected',
    category: 'status',
    semantics: 'A rejected, orphaned, or failed status; the reserved orphaned glyph.',
    statusTone: 'orphaned',
  },
  zap: {
    name: 'zap',
    label: 'Instant',
    category: 'status',
    semantics: 'An instant or fast-execution action.',
  },
};

/**
 * Reserved status semantics: each status tone maps to exactly one approved
 * glyph. UI must never encode a status meaning with an arbitrary icon.
 */
export const STATUS_ICON_NAMES: Readonly<Record<StatusToneName, IconName>> = {
  neutral: 'info',
  pending: 'clock',
  confirmed: 'check-circle',
  finalized: 'shield',
  orphaned: 'x-circle',
  success: 'check-circle',
  warning: 'alert-triangle',
  danger: 'alert-triangle',
  info: 'info',
};

export function isIconName(value: string): value is IconName {
  return (ICON_NAMES as readonly string[]).includes(value);
}

export function getIconDefinition(name: IconName): IconDefinition {
  return ICON_CATALOGUE[name];
}

export function getStatusIconName(tone: StatusToneName): IconName {
  return STATUS_ICON_NAMES[tone];
}
