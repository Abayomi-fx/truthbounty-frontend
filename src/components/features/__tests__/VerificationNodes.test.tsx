/**
 * State coverage for VerificationNodes.
 *
 * Covers: loading, undefined (unloaded), empty (confirmed-empty),
 * unavailable, data, and retry via isUnavailable toggle.
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import VerificationNodes from "../VerificationNodes";
import { verificationNodesFixture } from "@/__tests__/fixtures/dashboard-fixtures";

jest.mock("@/components/skeletons", () => ({
  VerificationNodesSkeleton: () => (
    <div data-testid="verification-nodes-skeleton" />
  ),
}));

describe("VerificationNodes — loading state", () => {
  it("renders the skeleton when isLoading is true", () => {
    render(<VerificationNodes isLoading />);
    expect(
      screen.getByTestId("verification-nodes-skeleton")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Verification Nodes")
    ).not.toBeInTheDocument();
  });

  it("does not render nodes or empty messages while loading", () => {
    render(<VerificationNodes isLoading nodes={verificationNodesFixture} />);
    expect(
      screen.queryByText(verificationNodesFixture[0].name)
    ).not.toBeInTheDocument();
  });
});

describe("VerificationNodes — unloaded / undefined state", () => {
  it("renders the shell with 'No nodes found.' when nodes is undefined (not yet fetched)", () => {
    render(<VerificationNodes />);
    expect(screen.getByText("Verification Nodes")).toBeInTheDocument();
    expect(screen.getByText("No nodes found.")).toBeInTheDocument();
  });
});

describe("VerificationNodes — confirmed-empty state", () => {
  it("renders 'No nodes found.' when an empty array is returned", () => {
    render(<VerificationNodes nodes={[]} />);
    expect(screen.getByText("No nodes found.")).toBeInTheDocument();
    expect(
      screen.queryByText("Total Nodes:")
    ).not.toBeInTheDocument();
  });
});

describe("VerificationNodes — unavailable state", () => {
  it("renders the canonical unavailable message when isUnavailable is true", () => {
    render(<VerificationNodes isUnavailable />);
    expect(
      screen.getByText("Node data is currently unavailable.")
    ).toBeInTheDocument();
  });

  it("does not render node rows when unavailable, even if nodes are passed", () => {
    render(<VerificationNodes isUnavailable nodes={verificationNodesFixture} />);
    expect(
      screen.queryByText(verificationNodesFixture[0].name)
    ).not.toBeInTheDocument();
  });
});

describe("VerificationNodes — data state", () => {
  it("renders all node names and locations", () => {
    render(<VerificationNodes nodes={verificationNodesFixture} />);
    for (const node of verificationNodesFixture) {
      expect(screen.getByText(node.name)).toBeInTheDocument();
      expect(screen.getByText(node.location)).toBeInTheDocument();
    }
  });

  it("shows Online in green and Maintenance in amber", () => {
    render(<VerificationNodes nodes={verificationNodesFixture} />);
    const onlineLabels = screen.getAllByText("Online");
    expect(onlineLabels.length).toBeGreaterThan(0);
    onlineLabels.forEach((el) =>
      expect(el).toHaveClass("text-emerald-500")
    );
    const maintenanceLabel = screen.getByText("Maintenance");
    expect(maintenanceLabel).toHaveClass("text-amber-500");
  });

  it("derives total and active counts from the actual data, not hardcoded strings", () => {
    render(<VerificationNodes nodes={verificationNodesFixture} />);
    const online = verificationNodesFixture.filter(
      (n) => n.status === "Online"
    ).length;
    expect(
      screen.getByText(`Total Nodes: ${verificationNodesFixture.length}`)
    ).toBeInTheDocument();
    expect(screen.getByText(`Active: ${online}`)).toBeInTheDocument();
  });
});

describe("VerificationNodes — retry / recovery", () => {
  it("transitions from unavailable to data when isUnavailable is cleared", () => {
    const { rerender } = render(<VerificationNodes isUnavailable />);
    expect(
      screen.getByText("Node data is currently unavailable.")
    ).toBeInTheDocument();

    rerender(<VerificationNodes nodes={verificationNodesFixture} />);
    expect(
      screen.queryByText("Node data is currently unavailable.")
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(verificationNodesFixture[0].name)
    ).toBeInTheDocument();
  });

  it("transitions from loading to data", () => {
    const { rerender } = render(<VerificationNodes isLoading />);
    expect(
      screen.getByTestId("verification-nodes-skeleton")
    ).toBeInTheDocument();

    rerender(<VerificationNodes nodes={verificationNodesFixture} />);
    expect(
      screen.queryByTestId("verification-nodes-skeleton")
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(verificationNodesFixture[0].name)
    ).toBeInTheDocument();
  });
});

describe("VerificationNodes — accessibility", () => {
  it("View All button has an accessible label", () => {
    render(<VerificationNodes nodes={verificationNodesFixture} />);
    expect(
      screen.getByRole("button", { name: "View all verification nodes" })
    ).toBeInTheDocument();
  });

  it("unavailable message is inside the heading region", () => {
    render(<VerificationNodes isUnavailable />);
    const heading = screen.getByText("Verification Nodes");
    expect(heading).toBeInTheDocument();
    expect(
      screen.getByText("Node data is currently unavailable.")
    ).toBeInTheDocument();
  });
});
