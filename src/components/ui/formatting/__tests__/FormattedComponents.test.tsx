import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  FormattedToken,
  FormattedNumber,
  FormattedTime,
  FormattedDuration,
  FormattedAddress,
} from "../index";

describe("Accessible Formatting UI Components", () => {
  describe("<FormattedToken />", () => {
    it("renders formatted token amount with tabular figures and accessible label", () => {
      render(<FormattedToken amount={45200} symbol="TBNT" />);

      const tokenEl = screen.getByLabelText("45,200 TBNT tokens");
      expect(tokenEl).toBeInTheDocument();
      expect(tokenEl).toHaveClass("tabular-nums");
      expect(screen.getByText("45,200")).toBeInTheDocument();
      expect(screen.getByText("TBNT")).toBeInTheDocument();
    });

    it("renders raw BigInt base units safely without precision loss", () => {
      const amountWei = 1_000_000_000_000_000_000n; // 1 token
      render(<FormattedToken amount={amountWei} symbol="TBNT" />);

      expect(screen.getByLabelText("1 TBNT tokens")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("shows title tooltip on compact representation", () => {
      render(<FormattedToken amount={1_500_000} compact symbol="TBNT" />);

      const tokenEl = screen.getByLabelText("1.5M TBNT tokens");
      expect(tokenEl).toHaveAttribute("title", "1,500,000 TBNT");
    });
  });

  describe("<FormattedNumber />", () => {
    it("renders decimal numbers with tabular-nums", () => {
      render(<FormattedNumber value={847291} type="decimal" />);

      const el = screen.getByLabelText("847,291");
      expect(el).toBeInTheDocument();
      expect(el).toHaveClass("tabular-nums");
    });

    it("renders currency correctly", () => {
      render(<FormattedNumber value={45200} type="currency" currency="USD" />);

      expect(screen.getByLabelText("$45,200")).toBeInTheDocument();
    });

    it("renders percentage with accessibility label", () => {
      render(<FormattedNumber value={97} type="percent" />);

      expect(screen.getByLabelText("97%")).toBeInTheDocument();
    });
  });

  describe("<FormattedTime />", () => {
    const testDate = "2026-01-25T14:32:00.000Z";

    it("renders semantic HTML5 <time> tag with dateTime attribute", () => {
      render(<FormattedTime date={testDate} mode="datetime" />);

      const timeEl = screen.getByText(/Jan 25, 2026/);
      expect(timeEl.tagName.toLowerCase()).toBe("time");
      expect(timeEl).toHaveAttribute("dateTime", testDate);
    });

    it("renders relative time with fallback to accessible full date", () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      render(<FormattedTime date={tenMinutesAgo} mode="relative" />);

      const timeEl = screen.getByText("10m ago");
      expect(timeEl.tagName.toLowerCase()).toBe("time");
    });

    it("renders fallback text on invalid date without crashing", () => {
      render(<FormattedTime date="invalid" fallback="Unavailable" />);

      expect(screen.getByText("Unavailable")).toBeInTheDocument();
    });
  });

  describe("<FormattedDuration />", () => {
    it("renders duration countdown in semantic <time> tag", () => {
      // 10m = 600s
      render(<FormattedDuration duration={600} />);

      const el = screen.getByText("10m");
      expect(el.tagName.toLowerCase()).toBe("time");
      expect(el).toHaveAttribute("dateTime", "PT600S");
      expect(el).toHaveAttribute("aria-label", "10m remaining");
    });

    it("renders 'Expired' for <= 0 duration", () => {
      render(<FormattedDuration duration={0} />);

      const el = screen.getByText("Expired");
      expect(el).toHaveAttribute("aria-label", "Window expired");
    });
  });

  describe("<FormattedAddress />", () => {
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E";

    it("renders truncated EVM address with font-mono", () => {
      render(<FormattedAddress address={testAddress} />);

      const el = screen.getByText("0x742d...eB1E");
      expect(el).toBeInTheDocument();
      expect(el).toHaveClass("font-mono");
    });

    it("handles copyable address with clipboard interactions", async () => {
      const mockClipboard = {
        writeText: jest.fn().mockResolvedValue(undefined),
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      render(<FormattedAddress address={testAddress} copyable />);

      const button = screen.getByRole("button", {
        name: new RegExp(`Copy address ${testAddress}`, "i"),
      });
      expect(button).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(button);
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith(testAddress);
    });
  });
});
