/**
 * Auth UI components — secure SIWE session UX and session lifecycle.
 *
 * V2-FE-047 — Secure SIWE session UX components (SiweSessionPanel).
 * V2-FE-048 — Session lifecycle UI (SessionLifecycleBanner).
 */

export {
  SiweSessionPanel,
  SiweSessionPanelView,
} from './SiweSessionPanel';
export type {
  SiweSessionPanelProps,
  SiweSessionPanelViewProps,
} from './SiweSessionPanel';

export { SessionLifecycleBanner } from './SessionLifecycleBanner';
export type { SessionLifecycleBannerProps } from './SessionLifecycleBanner';