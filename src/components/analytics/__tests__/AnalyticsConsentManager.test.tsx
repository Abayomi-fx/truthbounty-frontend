import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnalyticsConsentManager } from "../AnalyticsConsentManager";
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  ANALYTICS_EVENT_NAME,
  type MinimalPageViewEvent,
} from "@/lib/analytics/consent";

jest.mock("next/navigation", () => ({
  usePathname: () => "/claims/private-id",
}));

function overrideStorageFailure(method: "getItem" | "setItem"): () => void {
  const originalStorage = window.localStorage;
  const failingStorage = new Proxy(originalStorage, {
    get(target, property) {
      if (property === method) {
        return () => {
          throw new DOMException("Storage unavailable", "SecurityError");
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  Object.defineProperty(window, "localStorage", { configurable: true, value: failingStorage });
  return () => Object.defineProperty(window, "localStorage", { configurable: true, value: originalStorage });
}

describe("AnalyticsConsentManager", () => {
  let events: MinimalPageViewEvent[];
  let listener: (event: Event) => void;

  beforeEach(() => {
    window.localStorage.clear();
    events = [];
    listener = (event) => {
      events.push((event as CustomEvent<MinimalPageViewEvent>).detail);
    };
    window.addEventListener(ANALYTICS_EVENT_NAME, listener);
  });

  afterEach(() => {
    window.removeEventListener(ANALYTICS_EVENT_NAME, listener);
    jest.restoreAllMocks();
  });

  it("defaults to no analytics until the user chooses", async () => {
    render(<AnalyticsConsentManager><main>Content</main></AnalyticsConsentManager>);

    expect(await screen.findByRole("button", { name: "Allow optional analytics" })).toBeInTheDocument();
    expect(events).toEqual([]);
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBeNull();
  });

  it("emits only the coarse page view after explicit consent", async () => {
    render(<AnalyticsConsentManager><main>Content</main></AnalyticsConsentManager>);

    fireEvent.click(await screen.findByRole("button", { name: "Allow optional analytics" }));

    await waitFor(() => expect(events).toHaveLength(1));
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("granted");
    expect(events[0]).toEqual({
      version: 1,
      name: "page_view",
      page: "app",
      occurredAtMinute: expect.any(Number),
    });
    expect(JSON.stringify(events[0])).not.toContain("private-id");
  });

  it("persists rejection and emits no events", async () => {
    render(<AnalyticsConsentManager><main>Content</main></AnalyticsConsentManager>);

    fireEvent.click(await screen.findByRole("button", { name: "Reject optional analytics" }));

    await waitFor(() => {
      expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("denied");
      expect(screen.getByText("Optional analytics is off.")).toBeInTheDocument();
    });
    expect(events).toEqual([]);
  });

  it("allows the prompt to be dismissed without granting consent", async () => {
    render(<AnalyticsConsentManager><main>Content</main></AnalyticsConsentManager>);

    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));

    expect(screen.getByText("Optional analytics is not set.")).toBeInTheDocument();
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBeNull();
    expect(events).toEqual([]);
  });

  it("stops emitting after consent is revoked", async () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    render(<AnalyticsConsentManager><main>Content</main></AnalyticsConsentManager>);

    await waitFor(() => expect(events).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Manage analytics preferences" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject optional analytics" }));

    await waitFor(() => {
      expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("denied");
      expect(screen.getByText("Optional analytics is off.")).toBeInTheDocument();
    });
    expect(events).toHaveLength(1);
  });

  it("stops emitting when another tab revokes consent", async () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    render(<AnalyticsConsentManager><main>Content</main></AnalyticsConsentManager>);

    await waitFor(() => expect(events).toHaveLength(1));
    fireEvent(
      window,
      new StorageEvent("storage", {
        key: ANALYTICS_CONSENT_STORAGE_KEY,
        newValue: "denied",
      }),
    );

    await waitFor(() => expect(screen.getByText("Optional analytics is off.")).toBeInTheDocument());
    expect(events).toHaveLength(1);
  });

  it("keeps analytics off when the stored preference is invalid", async () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "maybe");
    render(<AnalyticsConsentManager><main>Content</main></AnalyticsConsentManager>);

    expect(await screen.findByRole("button", { name: "Allow optional analytics" })).toBeInTheDocument();
    expect(events).toEqual([]);
  });

  it("supports keyboard choice and restores focus to preference management", async () => {
    const user = userEvent.setup();
    render(<AnalyticsConsentManager><main>Content</main></AnalyticsConsentManager>);

    const allowButton = await screen.findByRole("button", { name: "Allow optional analytics" });
    await user.tab();
    expect(allowButton).toHaveFocus();
    await user.keyboard("{Enter}");

    const manageButton = await screen.findByRole("button", { name: "Manage analytics preferences" });
    await waitFor(() => expect(manageButton).toHaveFocus());
  });

  it("fails closed when browser storage is unavailable", async () => {
    const restoreStorage = overrideStorageFailure("getItem");
    try {
      render(<AnalyticsConsentManager><main>Content</main></AnalyticsConsentManager>);

      expect(await screen.findByRole("alert")).toHaveTextContent(/remains off/i);
      expect(screen.getByRole("button", { name: "Allow optional analytics" })).toBeDisabled();
      expect(events).toEqual([]);
    } finally {
      restoreStorage();
    }
  });

  it("fails closed if consent cannot be persisted", async () => {
    const restoreStorage = overrideStorageFailure("setItem");
    try {
      render(<AnalyticsConsentManager><main>Content</main></AnalyticsConsentManager>);

      fireEvent.click(await screen.findByRole("button", { name: "Allow optional analytics" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/could not save/i);
      expect(events).toEqual([]);
    } finally {
      restoreStorage();
    }
  });
});