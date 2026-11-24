
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
} from "@testing-library/react";

import AnalysisBoard from "./AnalysisBoard.jsx";

describe("AnalysisBoard clipboard handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeProps = () => ({
    form: {
      title: "Test assignment",
      arene_tier: "blue",
      learning_outcomes: "Test outcomes",
      assignment_text: "Test instructions",
    },

    analysis: {
      misalignment_alert: {
        status: "Review Recommended",
        summary: "Some evidence needs further review.",
        specific_gaps: [],
      },

      factors: [],
      proposed_checkpoints: [],
      arene_disclosure_note: "Test disclosure",
    },

    isAnalysisStale: false,
    piiMaskedCount: 0,
    activeProvider: "groq",

    onBackToSetup: vi.fn(),
    onUpdateFactorCoverage: vi.fn(),
    onUpdateCheckpoint: vi.fn(),
    onUpdateDisclosure: vi.fn(),
    onExportMarkdown: vi.fn(),
    onOpenStudentPreview: vi.fn(),

    exportedMarkdown: "# Test Markdown",
  });

  it("copies Markdown when clipboard access succeeds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<AnalysisBoard {...makeProps()} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Copy Markdown",
      })
    );

    await screen.findByRole("button", {
      name: "Copied",
    });

    expect(writeText).toHaveBeenCalledWith(
      "# Test Markdown"
    );
  });

  it("handles rejected clipboard writes without an unhandled error", async () => {
    const writeText = vi.fn().mockRejectedValue(
      new Error("Clipboard permission denied")
    );

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<AnalysisBoard {...makeProps()} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Copy Markdown",
      })
    );

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });

    expect(
      screen.getByRole("button", {
        name: "Copy Markdown",
      })
    ).toBeInTheDocument();
  });
});
