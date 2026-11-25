import React, { useState } from "react";
import { requestJson } from "../api.js";

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
  const providerLabel = activeProvider === "ollama" ? "local Ollama" : "external AI";

  const handleLoadSample = () => {
    updateActiveState({
      draft: sampleStudentDraft || "",
      aiDisclosure: requiresDisclosure && sampleAiDisclosure ? sampleAiDisclosure : activeState.aiDisclosure,
      result: null,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || isAnalysisStale) return;
    const requiredFields = [
      "title",
      "timing",
      "student_prompt",
      "reflection_question",
      "evidence_artifact",
    ];

    const missingFields = requiredFields.filter(
      (field) =>
        typeof activeCp?.[field] !== "string" ||
        !activeCp[field].trim()
    );

    if (missingFields.length > 0) {
      setError(
        `Complete the checkpoint before submitting. Missing: ${missingFields.join(", ")}.`
      );
      return;
    }

    setError("");
    setLoading(true);
    try {
      const data = await requestJson("/api/student-checkin", {
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
          disclosure_note: analysis?.arene_disclosure_note || "",
        }),
      });
      updateActiveState({ result: data });
    } catch (err) {
      setError(err.message || "Check-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stack-lg">
      <div className="role-strip row-between">
        <span>
          <strong>Student View</strong> · Checkpoint {selectedIdx + 1} of {Math.max(checkpoints.length, 1)} — Practice sandbox (nothing is saved)
        </span>
        {isAnalysisStale && (
          <button type="button" className="preset-pill" onClick={onBackToSetup}>
            Assignment changed — re-check
          </button>
        )}
      </div>

      <div className="panel stack-xl">
        {/* 1. Assignment & AI Policy */}
        <section className="board-section-flat stack-lg">
          <div className="row-between row-between-top">
            <div className="row-head-copy">
              <span className="eyebrow">1. Assignment &amp; AI Policy</span>
              <h2 className="section-title" style={{ marginTop: 2 }}>
                {form.title}
              </h2>
            </div>
            <button
              type="button"
              className="btn-secondary card-header-side"
              disabled={loading}
              onClick={onBackToReview}
            >
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
            {analysis?.arene_disclosure_note && (
              <div className="tier-callout-rule tier-callout-divider">
                <strong>Assignment disclosure guidance:</strong> {analysis.arene_disclosure_note}
              </div>
            )}
          </div>
        </section>

        {/* 2. Checkpoint */}
        <section className="board-section stack-lg">
          <div>
            <span className="eyebrow">2. Active Checkpoint</span>
            <h3 className="section-title" style={{ marginTop: 2 }}>
              Checkpoint Instructions
            </h3>
          </div>

          {checkpoints.length > 1 && (
            <div className="field-group">
              <label htmlFor="cp-select">Choose Checkpoint</label>
              <select
                id="cp-select"
                disabled={loading}
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
            <div className="card-header-row">
              <strong className="card-header-title">{activeCp.title}</strong>
              <span className="pill cov-partial card-header-side card-header-pill">
                {activeCp.timing}
              </span>
            </div>
            <p className="cp-line">
              <strong>Task:</strong> {activeCp.student_prompt}
            </p>
            <p className="cp-line">
              <strong>Reflection:</strong> {activeCp.reflection_question}
            </p>
            <p className="cp-meta">
              <strong>Hand in:</strong> {activeCp.evidence_artifact}
            </p>
          </div>
        </section>

        {/* 3. Student Check-In */}
        <section className="board-section">
          <form onSubmit={handleSubmit}>
            <fieldset disabled={loading} className="fieldset-reset stack-lg">
              <div>
                <span className="eyebrow">3. Student Check-In</span>
                <h3 className="section-title" style={{ marginTop: 2 }}>
                  Try a Student Check-In
                </h3>
                <p className="section-sub">
                  Pick how you&apos;ll evidence your progress, write a brief note, and test server-enforced AI behavior.
                </p>
              </div>

              <div className="field-group">
                <span className="field-label">How I&apos;ll Show My Progress</span>
                <div className="choice-grid">
                  {evidenceFormats.map((opt) => (
                    <label
                      key={opt}
                      className={`choice-item ${activeState.chosenFormat === opt ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="evidenceFormat"
                        checked={activeState.chosenFormat === opt}
                        onChange={() => updateActiveState({ chosenFormat: opt, result: null })}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                  <label
                    className={`choice-item choice-item-full ${
                      activeState.chosenFormat === "__custom__" ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="evidenceFormat"
                      checked={activeState.chosenFormat === "__custom__"}
                      onChange={() => updateActiveState({ chosenFormat: "__custom__", result: null })}
                    />
                    <span>Use a different format...</span>
                  </label>
                </div>
                {activeState.chosenFormat === "__custom__" && (
                  <input
                    type="text"
                    maxLength={400}
                    aria-label="Custom progress format"
                    value={activeState.customFormat}
                    onChange={(e) => updateActiveState({ customFormat: e.target.value, result: null })}
                    placeholder="e.g., 2-minute screen recording walking through my code"
                    required
                  />
                )}
              </div>

              <div className="field-group">
                <div className="row-between">
                  <label htmlFor="student-draft">Your Progress Note</label>
                  {sampleStudentDraft && (
                    <button type="button" className="preset-pill" onClick={handleLoadSample}>
                      Use Sample Note
                    </button>
                  )}
                </div>
                <textarea
                  id="student-draft"
                  rows={4}
                  maxLength={4000}
                  value={activeState.draft}
                  onChange={(e) => updateActiveState({ draft: e.target.value, result: null })}
                  placeholder="What have you done so far, what choices did you make, and where are you stuck?"
                  required
                />
              </div>

              {requiresDisclosure && (
                <div className="field-group">
                  <label htmlFor="ai-disclosure">
                    How You Used AI ({form.arene_tier === "blue" ? "Required · Blue Rule" : "Required · Yellow Rule"})
                  </label>
                  <textarea
                    id="ai-disclosure"
                    rows={2}
                    maxLength={4000}
                    className="textarea-compact"
                    value={activeState.aiDisclosure}
                    onChange={(e) => updateActiveState({ aiDisclosure: e.target.value, result: null })}
                    placeholder="Which AI tool did you use, and how did you verify its output?"
                  />
                </div>
              )}

              {loading && (
                <div className="info-banner status-banner" role="status" aria-live="polite">
                  <span className="spinner" aria-hidden="true" />
                  <span>
                    {aiAllowed
                      ? `Running Socratic check-in via ${providerLabel}...`
                      : "Verifying Red-tier policy status..."}
                  </span>
                </div>
              )}

              <div className="row-between">
                <span className="privacy-foot">
                  Demo only: do not paste real student work or personal data. Obvious IDs are masked before AI calls, but not fully anonymized.
                </span>
                <button type="submit" className="btn-primary" disabled={loading || isAnalysisStale}>
                  {loading
                    ? "Checking..."
                    : aiAllowed
                    ? "Ask Coach for Feedback"
                    : "Run Self-Check (No AI)"}
                </button>
              </div>

              {error && (
                <div className="error-banner" role="alert" style={{ marginBottom: 0 }}>
                  {error}
                </div>
              )}
            </fieldset>
          </form>
        </section>

        {/* 4. Coach Feedback */}
        {activeState.result && (
          <section className="board-section stack-lg" aria-live="polite">
            <div className="card-header-row">
              <div className="card-header-title">
                <span className="eyebrow">4. Feedback</span>
                <h3 className="section-title" style={{ marginTop: 2 }}>
                  {activeState.result.ai_assisted ? "AI Coach Feedback" : "Self-Check Checklist"}
                </h3>
              </div>
              <span
                className={`pill card-header-side card-header-pill ${
                  activeState.result.ai_assisted ? "cov-strong" : "cov-missing"
                }`}
              >
                {activeState.result.ai_assisted
                  ? "Coach Mode · Guidance Only"
                  : "AI Off · Red Rule"}
              </span>
            </div>

            {activeState.result.pii_masked_count > 0 && activeState.result.ai_assisted && (
              <div className="info-banner">
                Privacy check masked <strong>{activeState.result.pii_masked_count}</strong> identifier(s) before sending to {providerLabel}.
              </div>
            )}

            <div
              className={`feedback-card ${
                activeState.result.ai_assisted ? "" : "feedback-card-locked"
              }`}
            >
              <div className="feedback-cols">
                <div className="feedback-box">
                  <strong>{activeState.result.ai_assisted ? "What's working" : "Policy status"}</strong>
                  <ul>
                    {(activeState.result.feedback.strengths || []).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="feedback-box">
                  <strong>Questions to think about</strong>
                  <ul>
                    {(activeState.result.feedback.probing_questions || []).map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="feedback-meta">
                <p>
                  <strong>Format fit:</strong> {activeState.result.feedback.evidence_coaching}
                </p>
                <p>
                  <strong>Rules &amp; goals:</strong> {activeState.result.feedback.alignment_warning}
                </p>
                <p className="privacy-foot" style={{ marginBottom: 0 }}>
                  {activeState.result.feedback.policy_reminder}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}