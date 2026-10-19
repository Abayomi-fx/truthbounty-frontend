import { render, screen } from "@testing-library/react";
import { TransactionStatus } from "../TransactionStatus";

describe("TransactionStatus", () => {
  it("announces pending work without presenting it as success", () => {
    render(<TransactionStatus status="submitted" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Transaction submitted; waiting for confirmation.",
    );
    expect(screen.queryByText(/finalized/i)).not.toBeInTheDocument();
  });

  it.each(["dropped", "replaced", "reverted", "rejected", "reorged", "failed", "error"] as const)(
    "announces %s as an assertive recoverable failure",
    (status) => {
      render(<TransactionStatus status={status} />);

      const announcement = screen.getByRole("alert");
      expect(announcement).toHaveAttribute("aria-live", "assertive");
      expect(announcement).toHaveAttribute("aria-atomic", "true");
    },
  );

  it("announces finality only for the finalized state", () => {
    render(<TransactionStatus status="finalized" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Transaction finalized.",
    );
  });

  it("supports localized messages", () => {
    render(
      <TransactionStatus
        status="signature-requested"
        messages={{ "signature-requested": "Firma requerida" }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Firma requerida");
  });

  it("does not render an announcement while idle", () => {
    render(<TransactionStatus status="idle" />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps confirmed and stale states as progress announcements", () => {
    const { rerender } = render(<TransactionStatus status="confirmed" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Transaction confirmed; waiting for finality.",
    );
    expect(screen.getByRole("status")).not.toHaveClass("text-green-600");

    rerender(<TransactionStatus status="stale" />);
    expect(screen.getByRole("status")).toHaveTextContent(/stale/i);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });
});
