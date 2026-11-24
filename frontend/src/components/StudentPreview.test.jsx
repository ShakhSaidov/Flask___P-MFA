
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";

import StudentPreview from "./StudentPreview.jsx";

const makeProps = (tier = "blue") => ({
  form: {
    title: "Example assignment",
    learning_outcomes: "Evaluate evidence and justify decisions.",
    assignment_text: "Prepare an evidence-based report.",
    arene_tier: tier,
    custom_ai_rules: "",
  },

  analysis: {
    proposed_checkpoints: [
      {
        title: "Initial research",
        timing: "Early stage",
        student_prompt: "Describe your research approach.",
        reflection_question: "Why did you select these sources?",
        evidence_artifact: "Research notes",
      },
      {
        title: "Final reflection",
        timing: "Final stage",
        student_prompt: "Reflect on your decisions.",
        reflection_question: "What would you change?",
        evidence_artifact: "Reflection",
      },
    ],
  },

  isAnalysisStale: false,

  areneTiers: {
    blue: {
      label: "Blue — AI Required & Reported",
      rule: "AI must be used and reported.",
      student_ai_enabled: true,
      requires_disclosure: true,
    },
    green: {
      label: "Green — AI Allowed",
      rule: "AI is allowed.",
      student_ai_enabled: true,
      requires_disclosure: false,
    },
    yellow: {
      label: "Yellow — AI Allowed Within Bounds",
      rule: "AI use must follow course instructions.",
      student_ai_enabled: true,
      requires_disclosure: true,
    },
    red: {
      label: "Red — AI Prohibited",
      rule: "AI must not produce the assessed work.",
      student_ai_enabled: false,
      requires_disclosure: false,
    },
  },

  evidenceFormats: [
    "Annotated source log",
    "Versioned draft notes",
  ],

  activeProvider: "groq",

  sampleStudentDraft:
    "I compared two sources and documented why I selected one.",

  sampleAiDisclosure:
    "I used AI to identify possible search terms and verified the sources.",

  onBackToReview: vi.fn(),
  onBackToSetup: vi.fn(),
});

const mockResponse = (body, ok = true) => ({
  ok,
  json: async () => body,
});

describe("StudentPreview", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders the assignment and initial student draft", () => {
    render(<StudentPreview {...makeProps()} />);

    expect(
      screen.getByText("Example assignment")
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Checkpoint Draft or Reflection Note")
    ).toHaveValue(
      "I compared two sources and documented why I selected one."
    );
  });

  it("submits a student check-in and displays returned feedback", async () => {
    fetch.mockResolvedValueOnce(
      mockResponse({
        ai_assisted: true,
        pii_masked_count: 0,
        feedback: {
          strengths: [
            "You explained why you selected your source.",
          ],
          probing_questions: [
            "How would you verify the source's reliability?",
          ],
          evidence_coaching:
            "Keep a record of your source-selection decisions.",
          alignment_warning:
            "Connect your choices to the learning outcomes.",
          policy_reminder:
            "Verify all AI-generated suggestions.",
        },
      })
    );

    render(<StudentPreview {...makeProps()} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Get Socratic Feedback",
      })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Guided Reflection (Prompt-Based)")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "You explained why you selected your source."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "How would you verify the source's reliability?"
      )
    ).toBeInTheDocument();

    expect(fetch).toHaveBeenCalledWith(
      "/api/student-checkin",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("sends the selected Arene tier to the backend", async () => {
    fetch.mockResolvedValueOnce(
      mockResponse({
        ai_assisted: false,
        pii_masked_count: 0,
        feedback: {
          strengths: ["Independent reflection recorded."],
          probing_questions: ["Explain your decision."],
          evidence_coaching: "Document your reasoning.",
          alignment_warning: "Check the learning outcomes.",
          policy_reminder: "No AI coaching was used.",
        },
      })
    );

    render(<StudentPreview {...makeProps("red")} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Show Independent Self-Check",
      })
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const requestBody = JSON.parse(
      fetch.mock.calls[0][1].body
    );

    expect(requestBody.arene_tier).toBe("red");

    expect(
      screen.getByText("Independent Self-Check")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("AI Disabled (Red Tier)")
      ).toBeInTheDocument();
    });
  });

  it("displays an API error without crashing", async () => {
    fetch.mockResolvedValueOnce(
      mockResponse(
        { error: "The provider is temporarily unavailable." },
        false
      )
    );

    render(<StudentPreview {...makeProps()} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Get Socratic Feedback",
      })
    );

    expect(
      await screen.findByText(
        "The provider is temporarily unavailable."
      )
    ).toBeInTheDocument();
  });

  it("displays a network error when the request fails", async () => {
    fetch.mockRejectedValueOnce(
      new Error("Network unavailable")
    );

    render(<StudentPreview {...makeProps()} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Get Socratic Feedback",
      })
    );

    expect(
      await screen.findByText(
        "Network error contacting backend."
      )
    ).toBeInTheDocument();
  });

  it("changes the selected checkpoint", () => {
    render(<StudentPreview {...makeProps()} />);

    fireEvent.change(
      screen.getByLabelText("Select Checkpoint"),
      { target: { value: "1" } }
    );

    expect(
      screen.getByText("Final reflection")
    ).toBeInTheDocument();
  });

  it("does not submit when the analysis is stale", () => {
    render(
      <StudentPreview
        {...makeProps()}
        isAnalysisStale={true}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Get Socratic Feedback",
      })
    ).toBeDisabled();

    expect(fetch).not.toHaveBeenCalled();
  });

  it("clears previous feedback when the student edits the draft", async () => {
    fetch.mockResolvedValueOnce(
      mockResponse({
        ai_assisted: true,
        pii_masked_count: 0,
        feedback: {
          strengths: ["Previous feedback."],
          probing_questions: ["Previous question?"],
          evidence_coaching: "Previous note.",
          alignment_warning: "Previous warning.",
          policy_reminder: "Previous reminder.",
        },
      })
    );

    render(<StudentPreview {...makeProps()} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Get Socratic Feedback",
      })
    );

    expect(
      await screen.findByText("Previous feedback.")
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText("Checkpoint Draft or Reflection Note"),
      { target: { value: "Updated reflection." } }
    );

    expect(
      screen.queryByText("Previous feedback.")
    ).not.toBeInTheDocument();
  });
});
