/**
 * V2-FE-064 — Deployment Preview Verification Public API
 */

export {
  validatePreviewManifest,
  loadPreviewManifestFromEnv,
  PREVIEW_SUPPORTED_CHAIN_IDS,
  type PreviewSupportedChainId,
  type DeploymentEnvironment,
  type PreviewManifestFailureReason,
  type RawPreviewManifest,
  type ValidatedPreviewManifest,
  type PreviewManifestValidationResult,
} from './preview-manifest';

export {
  verifyPreviewDeployment,
  isPreviewVerified,
  buildVerificationSummary,
  type PreviewVerificationStatus,
  type PreviewVerificationResult,
  type PreviewDisplayInfo,
} from './preview-verification';
