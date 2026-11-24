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
    if (isAnalysisStale) return;
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
      setError("Could not reach the server. Check that Flask is running.");
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

      <div className="student-grid">
        <div className="panel stack-lg student-context-panel">
          <div className="row-between">
            <div>
              <span className="eyebrow">Assignment</span>
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
              <label htmlFor="cp-select">Choose Checkpoint</label>
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
            <p className="cp-meta">Hand in: {activeCp.evidence_artifact}</p>
          </div>
        </div>

        <form className="panel stack-lg" onSubmit={handleSubmit}>
          <div>
            <h3 className="section-title">Try a Student Check-In</h3>
            <p className="section-sub">
              Pick how you&apos;ll show your progress, write a quick note, and see how the AI coach responds.
            </p>
          </div>

          <div className="field-group">
            <span className="field-label">How I&apos;ll Show My Progress</span>
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
              <span>Use a different format...</span>
            </label>
            {activeState.chosenFormat === "__custom__" && (
              <input
                type="text"
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
              rows={5}
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
                className="textarea-compact"
                value={activeState.aiDisclosure}
                onChange={(e) => updateActiveState({ aiDisclosure: e.target.value, result: null })}
                placeholder="Which AI tool did you use, and how did you check its work?"
              />
            </div>
          )}

          <div className="row-between">
            <span className="privacy-foot">
              Demo only: do not paste real student work or personal data. Obvious IDs are hidden automatically, not fully anonymized.
            </span>
            <button type="submit" className="btn-primary" disabled={loading || isAnalysisStale}>
              {loading
                ? "Checking..."
                : aiAllowed
                ? "Ask Coach for Feedback"
                : "Run Self-Check (No AI)"}
            </button>
          </div>

          {error && <div className="error-banner">{error}</div>}

          {activeState.result && (
            <div className="stack-lg">
              {activeState.result.pii_masked_count > 0 && (
                <div className="info-banner">
                  Privacy check hid <strong>{activeState.result.pii_masked_count}</strong> personal detail(s) before sending to {providerLabel}.
                </div>
              )}

              <div className="cp-card-wide">
                <div className="row-between">
                  <strong>
                    {activeState.result.ai_assisted ? "AI Coach Feedback" : "Self-Check Checklist"}
                  </strong>
                  <span className={`pill ${activeState.result.ai_assisted ? "cov-strong" : "cov-missing"}`}>
                    {activeState.result.ai_assisted
                      ? "Coach Mode · Won't Write for You"
                      : "AI Off · Red Rule"}
                  </span>
                </div>

                <div className="feedback-body">
                  <strong>{activeState.result.ai_assisted ? "What's working:" : "Rule check:"}</strong>
                  <ul>
                    {(activeState.result.feedback.strengths || []).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>

                  <strong>Questions to think about:</strong>
                  <ul>
                    {(activeState.result.feedback.probing_questions || []).map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>

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
            </div>
          )}
        </form>
      </div>
    </div>
  );
}