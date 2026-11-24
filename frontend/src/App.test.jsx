
import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";

import App from "./App.jsx";

vi.mock("./components/AssignmentForm.jsx", () => ({
  default: function MockAssignmentForm(props) {
    return (
      <div>
        <div data-testid="active-sample">
          {props.activeSampleId || "none"}
        </div>

        <button
          onClick={() =>
            props.setForm({
              ...props.form,
              title: "Manually edited assignment",
            })
          }
        >
          Edit assignment
        </button>

        <button
          onClick={() =>
            props.onSelectSample({
              id: "sample-1",
              title: "Sample assignment",
              learning_outcomes: "Test outcomes",
              assignment_text: "Test instructions",
              arene_tier: "blue",
              custom_ai_rules: "",
              sample_student_draft: "Sample student draft",
              sample_ai_disclosure: "Sample disclosure",
            })
          }
        >
          Select sample
        </button>

        <button
          onClick={() => props.onSubmit({ preventDefault: vi.fn() })}
        >
          Analyze assignment
        </button>
      </div>
    );
  },
}));

vi.mock("./components/AnalysisBoard.jsx", () => ({
  default: function MockAnalysisBoard(props) {
    return (
      <div>
        <h2>Design Review</h2>
        <button onClick={props.onOpenStudentPreview}>
          Open Student Preview
        </button>
      </div>
    );
  },
}));

vi.mock("./components/StudentPreview.jsx", () => ({
  default: function MockStudentPreview(props) {
    const [draft, setDraft] = useState("Initial draft");

    return (
      <div>
        <h2>Student Preview</h2>

        <textarea
          aria-label="Student test draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />

        <button onClick={props.onBackToReview}>
          Back to Review
        </button>

        <p data-testid="saved-draft">{draft}</p>
      </div>
    );
  },
}));

const jsonResponse = (body) => ({
  ok: true,
  json: async () => body,
});

describe("App workflow", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());

    fetch.mockResolvedValueOnce(
      jsonResponse({
        samples: [
          {
            id: "initial-sample",
            title: "Initial assignment",
            learning_outcomes: "Initial outcomes",
            assignment_text: "Initial instructions",
            arene_tier: "blue",
            custom_ai_rules: "",
            sample_student_draft: "Initial student draft",
            sample_ai_disclosure: "",
          },
        ],
        arene_tiers: {},
        evidence_formats: ["Annotated source log"],
        active_provider: "groq",
      })
    );
  });

  it("clears the preset highlight when the assignment is edited", async () => {
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByTestId("active-sample")
      ).toHaveTextContent("initial-sample");
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit assignment",
      })
    );

    expect(
      screen.getByTestId("active-sample")
    ).toHaveTextContent("none");
  });

  it("preserves Student Preview state when navigating back to Review", async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        analysis: {
          proposed_checkpoints: [],
          factors: [],
        },
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByTestId("active-sample")
      ).toHaveTextContent("initial-sample");
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Analyze assignment",
      })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Design Review")
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open Student Preview",
      })
    );

    const draft = screen.getByLabelText("Student test draft");

    fireEvent.change(draft, {
      target: { value: "My completed reflection" },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Back to Review",
      })
    );

    expect(
      screen.getByText("Design Review")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open Student Preview",
      })
    );

    expect(
      screen.getByLabelText("Student test draft")
    ).toHaveValue("My completed reflection");
  });
});
