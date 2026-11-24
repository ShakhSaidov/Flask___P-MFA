import React, { useState } from "react";

export default function StudentPreview({
  form,
  analysis,
  isAnalysisStale,
  areneTiers,
  evidenceFormats,
  activeProvider,
  sampleStudentDraft,
  sampleAiDisclosure,
  onBackToReview,
  onBackToSetup,
}) {
  const checkpoints = analysis?.proposed_checkpoints || [];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [cpStates, setCpStates] = useState(() => ({
    0: {
      chosenFormat: evidenceFormats[0] || "",
      customFormat: "",
      draft: sampleStudentDraft || "",
      aiDisclosure: sampleAiDisclosure || "",
      result: null,
    },
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeState = cpStates[selectedIdx] || {
    chosenFormat: evidenceFormats[0] || "",
    customFormat: "",
    draft: "",
    aiDisclosure: "",
    result: null,
  };

  const updateActiveState = (patch) => {
    setCpStates((prev) => ({
      ...prev,
      [selectedIdx]: {
        ...(prev[selectedIdx] || {
          chosenFormat: evidenceFormats[0] || "",
          customFormat: "",
          draft: "",
          aiDisclosure: "",
          result: null,
        }),
        ...patch,
      },
    }));
  };

  const activeCp = checkpoints[selectedIdx] || {
    title: "Checkpoint 1",
    timing: "Early Stage",
    student_prompt: "Describe your plan and key sources.",
    reflection_question: "Why is this approach appropriate?",
    evidence_artifact: "Short plan",
  };

  const tierInfo = areneTiers[form.arene_tier] || {};
  const aiAllowed = tierInfo.student_ai_enabled !== false;
  const requiresDisclosure = Boolean(tierInfo.requires_disclosure);
  const effectiveFormat =
    activeState.chosenFormat === "__custom__"
      ? activeState.customFormat.trim()
      : activeState.chosenFormat;
  const providerLabel = activeProvider === "ollama" ? "local Ollama" : "external model";

  const handleLoadSample = () => {
    updateActiveState({
      draft: sampleStudentDraft || "",
      aiDisclosure: requiresDisclosure && sampleAiDisclosure ? sampleAiDisclosure : activeState.aiDisclosure,
      result: null,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isAnalysisStale) return;
    setError("");
    setLoading(true);
    try {
      const resp = await fetch("/api/student-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          learning_outcomes: form.learning_outcomes,
          assignment_text: form.assignment_text,
          checkpoint: activeCp,
          student_draft: activeState.draft,
          chosen_evidence_format: effectiveFormat,
          arene_tier: form.arene_tier,
          custom_ai_rules: form.custom_ai_rules,
          ai_disclosure: requiresDisclosure ? activeState.aiDisclosure : "",
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "Check-in failed.");
      } else {
        updateActiveState({ result: data });
      }
    } catch {
      setError("Network error contacting backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stack-lg">
      <div className="role-strip row-between">
        <span>
          <strong>Simulated Student View</strong> · Checkpoint {selectedIdx + 1} of {Math.max(checkpoints.length, 1)} (in-browser simulation, nothing is saved)
        </span>
        {isAnalysisStale && (
          <button type="button" className="preset-pill" onClick={onBackToSetup}>
            Inputs changed — re-analyze in Setup
          </button>
        )}
      </div>

      <div className="student-grid">
        <div className="panel stack-lg">
          <div className="row-between">
            <div>
              <span className="eyebrow">Assignment Context</span>
              <h2 className="section-title" style={{ marginTop: 2 }}>
                {form.title}
              </h2>
            </div>
            <button type="button" className="btn-secondary" onClick={onBackToReview}>
              ← Back to Review
            </button>
          </div>

          <div className="tier-callout" style={{ borderLeftColor: tierInfo.badge || "#363E3C" }}>
            <strong>{tierInfo.label}</strong>
            <div className="tier-callout-rule">{tierInfo.rule}</div>
            {form.custom_ai_rules && (
              <div className="tier-callout-rule" style={{ marginTop: 6 }}>
                <strong>Course rules:</strong> {form.custom_ai_rules}
              </div>
            )}
          </div>

          {checkpoints.length > 1 && (
            <div className="field-group">
              <label htmlFor="cp-select">Select Checkpoint</label>
              <select
                id="cp-select"
                value={selectedIdx}
                onChange={(e) => {
                  setSelectedIdx(Number(e.target.value));
                  setError("");
                }}
              >
                {checkpoints.map((cp, idx) => (
                  <option key={idx} value={idx}>
                    Checkpoint {idx + 1}: {cp.title} ({cp.timing})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="cp-card-wide">
            <div className="row-between">
              <strong>{activeCp.title}</strong>
              <span className="pill cov-partial">{activeCp.timing}</span>
            </div>
            <p className="cp-line">
              <strong>Task:</strong> {activeCp.student_prompt}
            </p>
            <p className="cp-line">
              <strong>Reflection:</strong> {activeCp.reflection_question}
            </p>
            <p className="cp-meta">Suggested artifact: {activeCp.evidence_artifact}</p>
          </div>
        </div>

        <form className="panel stack-lg" onSubmit={handleSubmit}>
          <div>
            <h3 className="section-title">Choose Your Evidence &amp; Check Your Progress</h3>
            <p className="section-sub">
              Pick how you want to demonstrate learning at this checkpoint and test your plan against the course AI rules.
            </p>
          </div>

          <div className="field-group">
            <span className="field-label">Evidence Format</span>
            {evidenceFormats.map((opt) => (
              <label key={opt} className={`choice-item ${activeState.chosenFormat === opt ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="evidenceFormat"
                  checked={activeState.chosenFormat === opt}
                  onChange={() => updateActiveState({ chosenFormat: opt, result: null })}
                />
                <span>{opt}</span>
              </label>
            ))}
            <label className={`choice-item ${activeState.chosenFormat === "__custom__" ? "selected" : ""}`}>
              <input
                type="radio"
                name="evidenceFormat"
                checked={activeState.chosenFormat === "__custom__"}
                onChange={() => updateActiveState({ chosenFormat: "__custom__", result: null })}
              />
              <span>Propose my own evidence format...</span>
            </label>
            {activeState.chosenFormat === "__custom__" && (
              <input
                type="text"
                value={activeState.customFormat}
                onChange={(e) => updateActiveState({ customFormat: e.target.value, result: null })}
                placeholder="Describe how you will demonstrate learning..."
                required
              />
            )}
          </div>

          <div className="field-group">
            <div className="row-between">
              <label htmlFor="student-draft">Checkpoint Draft or Reflection Note</label>
              {sampleStudentDraft && (
                <button type="button" className="preset-pill" onClick={handleLoadSample}>
                  Load Sample Draft
                </button>
              )}
            </div>
            <textarea
              id="student-draft"
              rows={5}
              value={activeState.draft}
              onChange={(e) => updateActiveState({ draft: e.target.value, result: null })}
              placeholder="Summarize your progress, key choices, and questions..."
              required
            />
          </div>

          {requiresDisclosure && (
            <div className="field-group">
              <label htmlFor="ai-disclosure">
                AI Use Declaration ({form.arene_tier === "blue" ? "Required by Blue Tier" : "Required by Yellow Tier"})
              </label>
              <input
                id="ai-disclosure"
                type="text"
                value={activeState.aiDisclosure}
                onChange={(e) => updateActiveState({ aiDisclosure: e.target.value, result: null })}
                placeholder="Briefly report which AI tools you used and how you verified outputs..."
              />
            </div>
          )}

          <div className="row-between">
            <span className="privacy-foot">
              Use synthetic examples only. Do not enter real student work, personal data, or confidential course material. Identifier masking is best-effort and does not make submitted content safe for external AI processing.
            </span>
            <button type="submit" className="btn-primary" disabled={loading || isAnalysisStale}>
              {loading
                ? "Reviewing Checkpoint..."
                : aiAllowed
                ? "Get Socratic Feedback"
                : "Show Independent Self-Check"}
            </button>
          </div>

          {error && <div className="error-banner">{error}</div>}

          {activeState.result && (
            <div className="stack-lg">
              {activeState.result.pii_masked_count > 0 && (
                <div className="info-banner">
                  Best-effort check masked <strong>{activeState.result.pii_masked_count}</strong> obvious identifier(s) before {providerLabel} processing.
                </div>
              )}

              <div className="cp-card-wide">
                <div className="row-between">
                  <strong>
                    {activeState.result.ai_assisted ? "Socratic Mentor Feedback" : "Independent Self-Check"}
                  </strong>
                  <span className={`pill ${activeState.result.ai_assisted ? "cov-strong" : "cov-missing"}`}>
                    {activeState.result.ai_assisted
                      ? "Guided Reflection (Prompt-Based)"
                      : "AI Disabled (Red Tier)"}
                  </span>
                </div>

                <div className="feedback-body">
                  <strong>{activeState.result.ai_assisted ? "What is working:" : "Policy status:"}</strong>
                  <ul>
                    {(activeState.result.feedback.strengths || []).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>

                  <strong>Questions for your next step:</strong>
                  <ul>
                    {(activeState.result.feedback.probing_questions || []).map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>

                  <p>
                    <strong>Evidence format note:</strong> {activeState.result.feedback.evidence_coaching}
                  </p>
                  <p>
                    <strong>Alignment &amp; policy:</strong> {activeState.result.feedback.alignment_warning}
                  </p>
                  <p className="privacy-foot" style={{ marginBottom: 0 }}>
                    {activeState.result.feedback.policy_reminder}
                  </p>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
