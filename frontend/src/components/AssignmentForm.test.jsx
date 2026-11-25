import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import AssignmentForm from "./AssignmentForm.jsx";

const SAMPLE_LIST = [
  {
    id: "ict-api",
    school: "Technology (ICT)",
    arene_tier: "blue",
    title: "Web Service & API Engineering",
    learning_outcomes: "Design REST APIs.",
    assignment_text: "Build a Flask service.",
    custom_ai_rules: "Explain every route.",
  },
  {
    id: "healthcare-impact",
    school: "Health Care & Social Services",
    arene_tier: "yellow",
    title: "AI in Healthcare",
    learning_outcomes: "Appraise evidence.",
    assignment_text: "Write an APA report.",
    custom_ai_rules: "Brainstorming only.",
  },
];

const TIERS = {
  blue: { short_title: "Blue · AI Required", short_desc: "Required and reported", badge: "#1d4ed8" },
  green: { short_title: "Green · AI Allowed", short_desc: "Allowed without report", badge: "#15803d" },
  yellow: { short_title: "Yellow · AI With Rules", short_desc: "Bounded and reported", badge: "#b45309" },
  red: { short_title: "Red · No AI", short_desc: "AI prohibited", badge: "#b91c1c" },
};

const makeProps = (overrides = {}) => ({
  form: {
    title: "Web Service & API Engineering",
    learning_outcomes: "Design REST APIs.",
    assignment_text: "Build a Flask service.",
    arene_tier: "blue",
    custom_ai_rules: "Explain every route.",
  },
  setForm: vi.fn(),
  samples: SAMPLE_LIST,
  activeSampleId: "ict-api",
  areneTiers: TIERS,
  activeProvider: "groq",
  loading: false,
  onSelectSample: vi.fn(),
  onClearForm: vi.fn(),
  onSubmit: vi.fn((e) => e.preventDefault()),
  ...overrides,
});

describe("AssignmentForm", () => {
  it("highlights the active preset and triggers sample selection and clear actions", () => {
    const props = makeProps();
    render(<AssignmentForm {...props} />);

    const activeBtn = screen.getByRole("button", { name: "Technology (ICT) · BLUE" });
    expect(activeBtn).toHaveClass("active");

    fireEvent.click(screen.getByRole("button", { name: "Health Care & Social Services · YELLOW" }));
    expect(props.onSelectSample).toHaveBeenCalledWith(SAMPLE_LIST[1]);

    fireEvent.click(screen.getByRole("button", { name: "Blank form" }));
    expect(props.onClearForm).toHaveBeenCalledTimes(1);
  });

  it("updates Arene tier selection with aria-pressed", () => {
    const props = makeProps();
    render(<AssignmentForm {...props} />);

    const yellowCard = screen.getByRole("button", { name: /Yellow · AI With Rules/i });
    expect(yellowCard).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(yellowCard);
    expect(props.setForm).toHaveBeenCalledWith(
      expect.objectContaining({ arene_tier: "yellow" })
    );
  });

  it("locks controls and shows status feedback while analyzing", () => {
    render(<AssignmentForm {...makeProps({ loading: true })} />);

    expect(screen.getByRole("status")).toHaveTextContent("Groq API");
    expect(screen.getByLabelText("Assignment Title")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Technology (ICT) · BLUE" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Analyzing Assignment..." })).toBeDisabled();
  });
});
