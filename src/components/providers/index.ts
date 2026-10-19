// src/components/providers/index.ts

export { QueryProvider } from './QueryProvider';
export { QueryDevtools, shouldRenderDevtools } from './QueryDevtools';
export { WebSocketProvider, useWebSocketContext, useWebSocketStatus } from './WebSocketProvider';
export { ThemeProvider, useTheme } from './ThemeProvider';
export { Web3Provider, RainbowKitThemedProvider } from './Web3Provider';
export { WalletStateGuard } from './WalletStateGuard';

// Cross-tab wallet & session context synchronization — UI-FE-059
export {
  CrossTabSyncProvider,
  useCrossTabSyncContext,
} from './CrossTabSyncProvider';
export type { CrossTabSyncProviderProps } from './CrossTabSyncProvider';

// Feature Flags
export { 
  FeatureFlagProvider, 
  useFeatureFlags, 
  useFeatureFlag,
  FeatureFlagContext 
} from './FeatureFlagProvider';
export { 
  FeatureFlagGate, 
  FeatureFlagSwitch, 
  FeatureFlagDisabled 
} from './FeatureFlag';
export { FeatureFlagPanel } from './FeatureFlagPanel';

// Telemetry — V2-FE-149
export {
  TelemetryProvider,
  TelemetryContext,
  useTelemetryContext,
} from './TelemetryProvider';
export type { TelemetryContextValue, TelemetryProviderProps } from './TelemetryProvider';

// Reduced data & constrained network — UI-FE-082
export {
  ReducedDataProvider,
  ReducedDataContext,
  useReducedDataContext,
} from './ReducedDataProvider';
export type {
  ReducedDataContextValue,
  ReducedDataProviderProps,
} from './ReducedDataProvider';
