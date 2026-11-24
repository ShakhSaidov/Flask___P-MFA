import React, { useState } from "react";

const COVERAGE_LABELS = {
  "Explicitly Evidenced": "Clearly Covered",
  "Implicit / Unverified": "Assumed / Unchecked",
  "Not Captured": "Missing",
};

const STATUS_LABELS = {
  "Well Aligned": "Well Aligned",
  "Review Recommended": "Needs Review",
  "Potential Alignment Gap": "Gap Found",
};

function coverageClass(cov) {
  if (cov === "Explicitly Evidenced") return "pill cov-strong";
  if (cov === "Implicit / Unverified") return "pill cov-partial";
  return "pill cov-missing";
}

export default function AnalysisBoard({
  form,
  analysis,
  isAnalysisStale,
  piiMaskedCount,
  activeProvider,
  onBackToSetup,
  onUpdateFactorCoverage,
  onUpdateCheckpoint,
  onUpdateDisclosure,
  onExportMarkdown,
  exportedMarkdown,
  onOpenStudentPreview,
}) {
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!analysis) return null;

  const alert = analysis.misalignment_alert || {};
  const alertClass =
    alert.status === "Well Aligned"
      ? "cov-strong"
      : alert.status === "Review Recommended"
      ? "cov-partial"
      : "cov-missing";
  const statusLabel = STATUS_LABELS[alert.status] || alert.status;

  const providerLabel = activeProvider === "ollama" ? "local Ollama" : "external AI";

  const requiredCheckpointFields = [
    "title",
    "timing",
    "evidence_artifact",
    "student_prompt",
    "reflection_question",
  ];

  const incompleteCheckpointNumbers = (
    analysis.proposed_checkpoints || []
  ).reduce((missing, checkpoint, index) => {
    const hasEmptyField = requiredCheckpointFields.some(
      (field) =>
        typeof checkpoint?.[field] !== "string" ||
        !checkpoint[field].trim()
    );

    if (hasEmptyField) {
      missing.push(index + 1);
    }

    return missing;
  }, []);

  const hasIncompleteCheckpoints =
    incompleteCheckpointNumbers.length > 0;

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExportMarkdown();
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    if (!exportedMarkdown || !navigator.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(exportedMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  return (
    <div className="panel stack-xl">
      {isAnalysisStale && (
        <div className="warn-banner row-between">
          <span>
            You changed the assignment. Re-run the check to update these results before exporting or testing Student View.
          </span>
          <button type="button" className="btn-secondary" onClick={onBackToSetup}>
            Re-run Check
          </button>
        </div>
      )}

      {piiMaskedCount > 0 && (
        <div className="info-banner">
          Privacy check hid <strong>{piiMaskedCount}</strong> personal detail(s) (email, phone, or Finnish ID) before sending to {providerLabel}.
        </div>
      )}

      {/* 1. Alignment Summary */}
      <section className="board-section-flat">
        <div className="row-between">
          <div>
            <span className="eyebrow">
              {form.title} · Arene {form.arene_tier.toUpperCase()}
            </span>
            <h2 className="section-title" style={{ marginTop: 2 }}>
              Alignment Check
            </h2>
            <p className="section-sub">
              Do your task and final deliverable actually prove the learning outcomes?
            </p>
          </div>
          <div className="btn-row">
            <span className={`pill ${alertClass}`}>{statusLabel}</span>
            <button type="button" className="btn-secondary" onClick={onBackToSetup}>
              Edit Assignment
            </button>
          </div>
        </div>

        <p className="lead-copy">{alert.summary}</p>
        {Array.isArray(alert.specific_gaps) && alert.specific_gaps.length > 0 && (
          <ul className="gap-list">
            {alert.specific_gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        )}
      </section>

      {/* 2. Six P-MFA Factors */}
      <section className="board-section">
        <div>
          <h3 className="section-title">6 Checks for Real Learning (P-MFA)</h3>
          <p className="section-sub">
            AI can fake a polished final essay. These 6 checks show what your task actually verifies. Change any rating if you disagree.
          </p>
        </div>

        <div className="factors-grid">
          {(analysis.factors || []).map((f, idx) => (
            <div key={f.name || idx} className="factor-card">
              <div className="factor-top">
                <div className="row-between">
                  <strong className="factor-name">{f.name}</strong>
                  <span className={coverageClass(f.coverage)}>
                    {COVERAGE_LABELS[f.coverage] || f.coverage}
                  </span>
                </div>
                {f.evidence_basis && (
                  <p className="factor-evidence">
                    <span className="factor-kicker">In your prompt:</span> {f.evidence_basis}
                  </p>
                )}
                <p className="factor-text">
                  <span className="factor-kicker">What&apos;s happening:</span> {f.diagnosis}
                </p>
                <p className="factor-rec">
                  <span className="factor-kicker">How to improve:</span> {f.recommendation}
                </p>
              </div>
              <div className="override-row">
                <label htmlFor={`override-${idx}`} className="override-label">
                  Your rating:
                </label>
                <select
                  id={`override-${idx}`}
                  className="override-select"
                  value={f.coverage}
                  onChange={(e) => onUpdateFactorCoverage(idx, e.target.value)}
                >
                  <option value="Explicitly Evidenced">Clearly Covered</option>
                  <option value="Implicit / Unverified">Assumed / Unchecked</option>
                  <option value="Not Captured">Missing</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Checkpoints */}
      <section className="board-section">
        <div className="row-between">
          <div>
            <h3 className="section-title">3 Checkpoints</h3>
            <p className="section-sub">
              Break the final deadline into 3 visible steps. Edit any box below before testing the Student View.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={onOpenStudentPreview}
            disabled={isAnalysisStale || hasIncompleteCheckpoints}
          >
            Test Student View →
          </button>
        </div>

        {hasIncompleteCheckpoints && (
          <div className="warn-banner" role="alert">
            <strong>Incomplete checkpoints:</strong>{" "}
            Complete all five required fields in checkpoint(s){" "}
            {incompleteCheckpointNumbers.join(", ")} before exporting
            the plan or opening Student View.
          </div>
        )}

        <div className="timeline-list">
          {(analysis.proposed_checkpoints || []).map((cp, idx) => (
            <div key={idx} className="timeline-item">
              <div className="timeline-marker" aria-hidden="true">
                {idx + 1}
              </div>

              <div className="cp-card-wide">
                <div className="cp-header-grid">
                  <div className="field-group">
                    <label htmlFor={`cp-title-${idx}`}>Checkpoint {idx + 1} Title</label>
                    <input
                      id={`cp-title-${idx}`}
                      type="text"
                      className="inline-input"
                      value={cp.title}
                      onChange={(e) => onUpdateCheckpoint(idx, "title", e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor={`cp-timing-${idx}`}>When</label>
                    <input
                      id={`cp-timing-${idx}`}
                      type="text"
                      className="inline-input"
                      value={cp.timing}
                      onChange={(e) => onUpdateCheckpoint(idx, "timing", e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor={`cp-artifact-${idx}`}>What Students Hand In</label>
                    <input
                      id={`cp-artifact-${idx}`}
                      type="text"
                      className="inline-input"
                      value={cp.evidence_artifact}
                      onChange={(e) => onUpdateCheckpoint(idx, "evidence_artifact", e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="field-group">
                    <label htmlFor={`cp-prompt-${idx}`}>Instructions for Students</label>
                    <textarea
                      id={`cp-prompt-${idx}`}
                      rows={4}
                      className="inline-input cp-textarea"
                      value={cp.student_prompt}
                      onChange={(e) => onUpdateCheckpoint(idx, "student_prompt", e.target.value)}
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor={`cp-reflection-${idx}`}>Reflection Question</label>
                    <textarea
                      id={`cp-reflection-${idx}`}
                      rows={4}
                      className="inline-input cp-textarea"
                      value={cp.reflection_question}
                      onChange={(e) => onUpdateCheckpoint(idx, "reflection_question", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. AI Rule & Export */}
      <section className="board-section">
        <label htmlFor="disclosure-note" className="section-title" style={{ display: "block" }}>
          AI Rule for Students
        </label>
        <p className="section-sub" style={{ marginBottom: 12 }}>
          Review or edit the rule students will see, then download your full assignment plan.
        </p>

        <textarea
          id="disclosure-note"
          rows={3}
          style={{ minHeight: 88 }}
          value={analysis.arene_disclosure_note || ""}
          onChange={(e) => onUpdateDisclosure(e.target.value)}
        />

        <div className="row-between" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onOpenStudentPreview}
            disabled={isAnalysisStale || hasIncompleteCheckpoints}
          >
            Test Student View
          </button>
          <div className="btn-row">
            {exportedMarkdown && (
              <button type="button" className="btn-secondary" onClick={handleCopy}>
                {copied ? "Copied" : "Copy Markdown"}
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={handleExport}
              disabled={exporting || isAnalysisStale || hasIncompleteCheckpoints}
            >
              {exporting ? "Creating Plan..." : "Download Plan (.md)"}
            </button>
          </div>
        </div>

        {exportedMarkdown && (
          <details className="export-details">
            <summary>Preview Markdown plan (pmfa-assessment-blueprint.md)</summary>
            <pre className="export-pre">{exportedMarkdown}</pre>
          </details>
        )}
      </section>
    </div>
  );
}