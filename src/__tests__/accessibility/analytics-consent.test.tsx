import React from "react";
import { render, screen } from "@testing-library/react";
import { assertAccessible } from "../utils/axe";
import { AnalyticsConsentManager } from "@/components/analytics/AnalyticsConsentManager";

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("Accessibility: analytics consent", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("labels the optional analytics choices and has no axe violations", async () => {
    const { container } = render(
      <AnalyticsConsentManager>
        <main>Application content</main>
      </AnalyticsConsentManager>,
    );

    expect(await screen.findByRole("button", { name: "Allow optional analytics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject optional analytics" })).toBeInTheDocument();
    await assertAccessible(container);
  });
});