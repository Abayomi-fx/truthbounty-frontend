import { redactForTelemetry } from "@/lib/security/redaction";

export const ANALYTICS_CONSENT_STORAGE_KEY = "truthbounty:analytics-consent:v1";
export const ANALYTICS_EVENT_NAME = "truthbounty:analytics";

export type AnalyticsConsentChoice = "granted" | "denied";
export type AnalyticsConsentPreference = AnalyticsConsentChoice | null;

export interface AnalyticsConsentReadResult {
  storageAvailable: boolean;
  corrupted: boolean;
  preference: AnalyticsConsentPreference;
}

export interface MinimalPageViewEvent {
  version: 1;
  name: "page_view";
  page: "home" | "app";
  occurredAtMinute: number;
}

type ConsentStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type AnalyticsEventTarget = Pick<Window, "dispatchEvent">;

export function readAnalyticsConsent(
  storage?: Pick<ConsentStorage, "getItem">,
): AnalyticsConsentReadResult {
  try {
    const activeStorage = storage ?? window.localStorage;
    const value = activeStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    if (value === "granted" || value === "denied") {
      return { storageAvailable: true, corrupted: false, preference: value };
    }
    if (value === null) {
      return { storageAvailable: true, corrupted: false, preference: null };
    }
    return { storageAvailable: true, corrupted: true, preference: null };
  } catch {
    return { storageAvailable: false, corrupted: false, preference: null };
  }
}

export function saveAnalyticsConsent(
  choice: AnalyticsConsentChoice,
  storage?: Pick<ConsentStorage, "setItem">,
): boolean {
  try {
    const activeStorage = storage ?? window.localStorage;
    activeStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, choice);
    return true;
  } catch {
    return false;
  }
}

export function clearAnalyticsConsent(
  storage?: Pick<ConsentStorage, "removeItem">,
): boolean {
  try {
    const activeStorage = storage ?? window.localStorage;
    activeStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
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
    const result = readAnalyticsConsent(activeStorage);
    if (!result.storageAvailable || result.preference !== "granted") {
      return false;
    }

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
