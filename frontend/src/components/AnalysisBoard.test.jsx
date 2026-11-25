import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
} from "@testing-library/react";

import AnalysisBoard from "./AnalysisBoard.jsx";

describe("AnalysisBoard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeProps = (overrides = {}) => ({
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
    exportError: "",
    ...overrides,
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

  it("flags incomplete checkpoints and blocks export and student preview", () => {
    const props = makeProps({
      exportedMarkdown: "",
      analysis: {
        misalignment_alert: {
          status: "Review Recommended",
          summary: "Summary",
          specific_gaps: [],
        },
        factors: [],
        proposed_checkpoints: [
          {
            title: "Scoping",
            timing: "   ",
            evidence_artifact: "Notes",
            student_prompt: "Write a plan.",
            reflection_question: "Why these sources?",
          },
        ],
        arene_disclosure_note: "Rule",
      },
    });

    render(<AnalysisBoard {...props} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Incomplete checkpoints:"
    );
    expect(screen.getByLabelText("When")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(
      screen.getByRole("button", { name: "Download Plan (.md)" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Test Student View →" })
    ).toBeDisabled();
  });

  it("flags empty disclosure guidance and disables export and student preview", () => {
    const props = makeProps({
      exportedMarkdown: "",
      analysis: {
        misalignment_alert: {
          status: "Review Recommended",
          summary: "Summary",
          specific_gaps: [],
        },
        factors: [],
        proposed_checkpoints: [],
        arene_disclosure_note: "   ",
      },
    });

    render(<AnalysisBoard {...props} />);

    expect(
      screen.getByLabelText("Student AI Policy & Disclosure Draft")
    ).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Disclosure guidance required:"
    );
    expect(
      screen.getByRole("button", { name: "Preview Markdown" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Download Plan (.md)" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Test Student View →" })
    ).toBeDisabled();
  });

  it("renders inline export errors near the export actions", () => {
    render(
      <AnalysisBoard
        {...makeProps({
          exportedMarkdown: "",
          exportError: "Could not export the plan.",
        })}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not export the plan."
    );
  });

  it("supports previewing Markdown without downloading", () => {
    const onExportMarkdown = vi.fn().mockResolvedValue("# Preview");
    render(
      <AnalysisBoard
        {...makeProps({ exportedMarkdown: "", onExportMarkdown })}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Preview Markdown" })
    );

    expect(onExportMarkdown).toHaveBeenCalledWith(false);
  });
});
