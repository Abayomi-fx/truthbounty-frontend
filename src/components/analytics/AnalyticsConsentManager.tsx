"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  publishPageView,
  saveAnalyticsConsent,
  type AnalyticsConsentChoice,
  type AnalyticsConsentPreference,
} from "@/lib/analytics/consent";

interface AnalyticsConsentManagerProps {
  children: ReactNode;
}

export function AnalyticsConsentManager({ children }: AnalyticsConsentManagerProps) {
  const pathname = usePathname();
  const [preference, setPreference] = useState<AnalyticsConsentPreference>(null);
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [notice, setNotice] = useState("");
  const lastTrackedPath = useRef<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const manageButtonRef = useRef<HTMLButtonElement>(null);
  const focusAfterTransition = useRef<"heading" | "manage" | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
      if (stored === "granted" || stored === "denied") {
        setPreference(stored);
        setPanelOpen(false);
      } else {
        setPreference(null);
      }
    } catch {
      setPreference("denied");
      setStorageAvailable(false);
      setNotice("This browser cannot save privacy choices. Optional analytics remains off.");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || preference !== "granted") {
      lastTrackedPath.current = null;
      return;
    }
    if (lastTrackedPath.current === pathname) return;

    lastTrackedPath.current = pathname;
    publishPageView(pathname);
  }, [pathname, preference, ready]);

  useEffect(() => {
    if (!ready || !focusAfterTransition.current) return;
    if (focusAfterTransition.current === "heading" && panelOpen) {
      headingRef.current?.focus();
    } else if (focusAfterTransition.current === "manage" && !panelOpen) {
      manageButtonRef.current?.focus();
    }
    focusAfterTransition.current = null;
  }, [panelOpen, ready]);

  useEffect(() => {
    const syncPreference = (event: StorageEvent) => {
      if (event.key !== ANALYTICS_CONSENT_STORAGE_KEY) return;
      const next = event.newValue === "granted" || event.newValue === "denied"
        ? event.newValue
        : null;
      setPreference(next);
      if (next !== null) setStorageAvailable(true);
      if (next === null) setPanelOpen(true);
    };
    window.addEventListener("storage", syncPreference);
    return () => window.removeEventListener("storage", syncPreference);
  }, []);

  const choosePreference = (choice: AnalyticsConsentChoice) => {
    if (choice === "granted" && !storageAvailable) return;

    let saved = false;
    try {
      saved = saveAnalyticsConsent(choice, window.localStorage);
    } catch {
      saved = false;
    }

    if (!saved) {
      setPreference("denied");
      setStorageAvailable(false);
      setNotice("We could not save that choice. Optional analytics remains off.");
      setPanelOpen(true);
      return;
    }

    setPreference(choice);
    setNotice(choice === "granted" ? "Optional analytics enabled." : "Optional analytics disabled.");
    focusAfterTransition.current = "manage";
    setPanelOpen(false);
  };

  const preferenceLabel = preference === "granted"
    ? "on"
    : preference === "denied"
      ? "off"
      : "not set";

  return (
    <>
      {children}
      <section
        aria-label="Analytics privacy controls"
        aria-busy={!ready}
        className="border-t border-border bg-muted/20 px-4 py-4 text-foreground"
      >
        {!ready ? (
          <p role="status" className="mx-auto w-full max-w-7xl text-sm">
            Loading privacy preference…
          </p>
        ) : panelOpen ? (
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-3xl">
              <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold">
                Optional analytics
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                If enabled, this page emits a coarse home/app page view and minute-rounded time. It excludes wallet details, claim identifiers, query strings, and evidence. No analytics network service is configured.
              </p>
              {!storageAvailable && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {notice || "This browser cannot save privacy choices. Optional analytics remains off."}
                </p>
              )}
              {storageAvailable && notice && (
                <p role="status" className="mt-2 text-sm text-muted-foreground">
                  {notice}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={!storageAvailable}
                onClick={() => choosePreference("granted")}
              >
                Allow optional analytics
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => choosePreference("denied")}
              >
                Reject optional analytics
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  focusAfterTransition.current = "manage";
                  setPanelOpen(false);
                }}
              >
                Not now
              </Button>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
            <p role="status" className="text-sm text-muted-foreground">
              Optional analytics is {preferenceLabel}.
            </p>
            <Button
              ref={manageButtonRef}
              type="button"
              variant="outline"
              onClick={() => {
                focusAfterTransition.current = "heading";
                setPanelOpen(true);
              }}
            >
              Manage analytics preferences
            </Button>
          </div>
        )}
      </section>
    </>
  );
}