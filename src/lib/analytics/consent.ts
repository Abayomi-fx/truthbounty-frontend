import { redactForTelemetry } from "@/lib/security/redaction";

export const ANALYTICS_CONSENT_STORAGE_KEY = "truthbounty:analytics-consent:v1";
export const ANALYTICS_EVENT_NAME = "truthbounty:analytics";

export type AnalyticsConsentChoice = "granted" | "denied";
export type AnalyticsConsentPreference = AnalyticsConsentChoice | null;

export interface MinimalPageViewEvent {
  version: 1;
  name: "page_view";
  page: "home" | "app";
  occurredAtMinute: number;
}

type ConsentStorage = Pick<Storage, "getItem" | "setItem">;
type AnalyticsEventTarget = Pick<Window, "dispatchEvent">;

export function readAnalyticsConsent(
  storage: Pick<ConsentStorage, "getItem">,
): AnalyticsConsentPreference {
  try {
    const value = storage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function saveAnalyticsConsent(
  choice: AnalyticsConsentChoice,
  storage: Pick<ConsentStorage, "setItem">,
): boolean {
  try {
    storage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, choice);
    return true;
  } catch {
    return false;
  }
}

export function publishPageView(
  pathname: string | null,
  storage?: Pick<ConsentStorage, "getItem">,
  target?: AnalyticsEventTarget,
  now = Date.now(),
): boolean {
  try {
    const activeStorage = storage ?? window.localStorage;
    if (readAnalyticsConsent(activeStorage) !== "granted") return false;

    const event: MinimalPageViewEvent = {
      version: 1,
      name: "page_view",
      page: pathname === "/" ? "home" : "app",
      occurredAtMinute: Math.floor(now / 60_000),
    };
    const detail = redactForTelemetry(event) as MinimalPageViewEvent;
    const eventTarget = target ?? window;
    return eventTarget.dispatchEvent(
      new CustomEvent<MinimalPageViewEvent>(ANALYTICS_EVENT_NAME, { detail }),
    );
  } catch {
    return false;
  }
}